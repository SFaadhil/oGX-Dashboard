// Thin EXPA GraphQL client.
//
// Verified against https://gis-api.aiesec.org/graphql on 2026-08-28:
//   - AIESEC in India MC office id .......... 1585   (1518 is AIESEC in Maribor)
//   - Programme ids ......................... 7 = GV, 8 = GTa, 9 = GTe
//   - Applications root ..................... allOpportunityApplication
//   - EP-side home entity filter ............ ApplicationFilter.person_home_mc: Int[]
//   - Product filter ........................ ApplicationFilter.programmes: Int[]
//   - Incremental window .................... ApplicationFilter.created_at: { from, to }

export const INDIA_MC_ID = 1585;

export const PROGRAMMES = {
  GV: 7,
  GTa: 8,
  GTe: 9
};

export const PROGRAMME_PRODUCT = {
  8: 'GTa',
  9: 'GTe'
};

const ENDPOINT = process.env.EXPA_ENDPOINT || 'https://gis-api.aiesec.org/graphql';

export const APPLICATIONS_QUERY = `
query OgxApplications($page: Int, $per_page: Int, $filters: ApplicationFilter) {
  allOpportunityApplication(page: $page, per_page: $per_page, filters: $filters) {
    data {
      id
      status
      current_status
      created_at
      updated_at
      experience_start_date
      experience_end_date
      cv { id url }
      slot { id start_date end_date title }
      person {
        id
        full_name
        first_name
        last_name
        email
        dob
        gender
        linkedin_url
        cv_url
        is_aiesecer
        latest_graduation_date
        contact_detail { phone }
        home_lc { id name }
        home_mc { id name }
        latest_academic_level { id name }
        latest_academic { id title organisation_name start_date end_date }
        academic_experiences { id title organisation_name start_date end_date }
        latest_academic_experience_backgrounds { id name }
        managers { id full_name email }
        person_profile {
          selected_programmes
          duration_min
          duration_max
          earliest_start_date
          latest_end_date
          backgrounds { id name }
        }
      }
      opportunity {
        id
        title
        duration
        programme { id short_name_display }
        sub_product { id name }
        opportunity_duration_type { id duration_type duration_min duration_max }
        earliest_start_date
        latest_end_date
        home_lc { id name }
        home_mc { id name country_code }
      }
    }
    paging { total_pages current_page total_items }
  }
}`;

export class ExpaError extends Error {}

export function createExpaClient({ token, endpoint = ENDPOINT, fetchImpl = fetch } = {}) {
  if (!token) throw new ExpaError('EXPA_ACCESS_TOKEN is not set.');

  async function graphql(query, variables, { retries = 3 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetchImpl(`${endpoint}?access_token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables })
        });

        if (res.status === 401 || res.status === 403) {
          throw new ExpaError(`EXPA rejected the access token (HTTP ${res.status}). It has probably expired.`);
        }

        // Rate limited or a transient upstream blip - back off and retry.
        if (res.status === 429 || res.status >= 500) {
          lastError = new ExpaError(`EXPA returned HTTP ${res.status}`);
          // eslint-disable-next-line no-await-in-loop
          await sleep(2 ** attempt * 1500);
          continue;
        }

        const body = await res.json();
        if (body.errors?.length) {
          throw new ExpaError(`EXPA GraphQL error: ${body.errors.map((e) => e.message).join(' | ')}`);
        }
        return body.data;
      } catch (err) {
        if (err instanceof ExpaError && !/HTTP 5|HTTP 429/.test(err.message)) throw err;
        lastError = err;
        // eslint-disable-next-line no-await-in-loop
        await sleep(2 ** attempt * 1500);
      }
    }
    throw lastError || new ExpaError('EXPA request failed.');
  }

  /**
   * Page through every application matching the filter.
   * `onPage` is called with each page so callers can stream rather than buffer.
   */
  async function fetchApplications({
    homeMc = INDIA_MC_ID,
    programmes = [PROGRAMMES.GTa, PROGRAMMES.GTe],
    from,
    to,
    perPage = 100,
    maxPages = 500,
    onPage
  }) {
    const filters = {
      person_home_mc: [homeMc],
      programmes,
      sort: 'created_at',
      sort_direction: 'desc'
    };
    if (from || to) {
      filters.created_at = {};
      if (from) filters.created_at.from = new Date(from).toISOString();
      if (to) filters.created_at.to = new Date(to).toISOString();
    }

    const all = [];
    let page = 1;
    let totalPages = 1;
    let totalItems = 0;

    while (page <= totalPages && page <= maxPages) {
      // eslint-disable-next-line no-await-in-loop
      const data = await graphql(APPLICATIONS_QUERY, { page, per_page: perPage, filters });
      const node = data.allOpportunityApplication;
      const rows = node?.data || [];
      totalPages = node?.paging?.total_pages || 1;
      totalItems = node?.paging?.total_items || rows.length;

      if (onPage) await onPage(rows, { page, totalPages, totalItems });
      else all.push(...rows);

      if (!rows.length) break;
      page += 1;
    }

    return { rows: all, totalItems, pagesFetched: page - 1 };
  }

  async function whoAmI() {
    const data = await graphql('{ currentPerson { id full_name email home_lc { id name } } }', {});
    return data.currentPerson;
  }

  return { graphql, fetchApplications, whoAmI };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
