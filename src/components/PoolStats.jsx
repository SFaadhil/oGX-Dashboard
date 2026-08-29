import { useMemo } from 'react';
import { FiUsers, FiBookOpen, FiTag, FiPieChart, FiBarChart2, FiTrendingUp } from 'react-icons/fi';
import { PRODUCT_COLORS } from '../constants';
import { countBy, percent, sortedEntries, yearLabel } from '../lib/helpers';
import './PoolStats.css';

const DURATION_ORDER = ['Short Term', 'Mid Term', 'Long Term'];
const YEAR_ORDER = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Graduate', 'Not specified'];
const NEUTRAL_RAMP = ['#520305', '#7a1418', '#a03c3f', '#c0716f', '#d9a8a3', '#8a8a8a', '#e5e5e5'];

function Donut({ segments, total }) {
  const r = 38;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-chart">
      <svg viewBox="0 0 100 100" className="donut">
        {segments.map((s) => {
          const len = total ? (s.value / total) * circumference : 0;
          const dash = `${len} ${circumference - len}`;
          const el = (
            <circle
              key={s.label}
              cx="50" cy="50" r={r}
              fill="transparent"
              stroke={s.color}
              strokeWidth="12"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += len;
          return el;
        })}
        <circle cx="50" cy="50" r="28" className="donut-hole" />
      </svg>
      <div className="donut-center">
        <span className="donut-total">{total}</span>
        <span className="donut-label">Total</span>
      </div>
    </div>
  );
}

export default function PoolStats({ leads }) {
  const stats = useMemo(() => {
    const total = leads.length;

    const products = countBy(leads, (l) => (l.product === 'GTa' || l.product === 'GTe' ? l.product : null));
    const productSegments = ['GTa', 'GTe']
      .filter((p) => products[p])
      .map((p) => ({ label: p, value: products[p], color: PRODUCT_COLORS[p] }));

    const durations = countBy(leads, (l) => l.duration);
    const years = countBy(leads, (l) => yearLabel(l.year_of_studies) || 'Not specified');

    const backgroundCounts = countBy(leads, (l) => (l.backgrounds || []).map((b) => b.name));
    const topBackgrounds = sortedEntries(backgroundCounts);

    const universities = new Set(leads.map((l) => l.university).filter(Boolean));

    return {
      total,
      productSegments,
      durations,
      years,
      topBackgrounds,
      universityCount: universities.size,
      backgroundCount: Object.keys(backgroundCounts).length
    };
  }, [leads]);

  const maxYear = Math.max(1, ...Object.values(stats.years));
  const maxBg = stats.topBackgrounds.length ? stats.topBackgrounds[0][1] : 1;

  return (
    <div className="stats-container">
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon-wrapper"><FiUsers /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total CVs</span>
          </div>
          <div className="stat-trend positive"><FiTrendingUp /> Active</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper"><FiBookOpen /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.universityCount}</span>
            <span className="stat-label">Universities</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper"><FiTag /></div>
          <div className="stat-content">
            <span className="stat-value">{stats.backgroundCount}</span>
            <span className="stat-label">Backgrounds</span>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <h3 className="chart-title"><FiPieChart /> Product Distribution</h3>
          <Donut segments={stats.productSegments} total={stats.total} />
          <div className="chart-legend">
            {stats.productSegments.map((s) => (
              <div className="legend-item" key={s.label}>
                <span className="legend-color" style={{ backgroundColor: s.color }} />
                <span className="legend-label">{s.label}</span>
                <span className="legend-value">
                  {s.value} ({percent(s.value, stats.total)}%)
                </span>
              </div>
            ))}
            {!stats.productSegments.length && <span className="chart-empty">No product data</span>}
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-title"><FiBarChart2 /> Duration Distribution</h3>
          <div className="bar-chart">
            {DURATION_ORDER.filter((d) => stats.durations[d]).map((d, i) => (
              <div className="bar-item" key={d}>
                <div className="bar-label">
                  <span>{d}</span>
                  <span className="bar-value">{stats.durations[d]} CVs</span>
                </div>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${percent(stats.durations[d], stats.total)}%`,
                      backgroundColor: NEUTRAL_RAMP[i]
                    }}
                  />
                </div>
              </div>
            ))}
            {!DURATION_ORDER.some((d) => stats.durations[d]) && (
              <span className="chart-empty">No duration data</span>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-title"><FiUsers /> Year of Study</h3>
          <div className="year-distribution">
            {YEAR_ORDER.filter((y) => stats.years[y]).map((y, i) => (
              <div className="year-item" key={y}>
                <div className="year-label">
                  <span>{y}</span>
                  <span className="year-count">{stats.years[y]}</span>
                </div>
                <div className="year-bar-container">
                  <div
                    className="year-bar-fill"
                    style={{
                      width: `${(stats.years[y] / maxYear) * 100}%`,
                      backgroundColor: NEUTRAL_RAMP[i % NEUTRAL_RAMP.length]
                    }}
                  />
                </div>
              </div>
            ))}
            {!YEAR_ORDER.some((y) => stats.years[y]) && <span className="chart-empty">No year data available</span>}
          </div>
        </div>
      </div>

      <div className="distribution-card">
        <h3 className="distribution-title"><FiTag /> Top Backgrounds</h3>
        <div className="backgrounds-grid">
          {stats.topBackgrounds.slice(0, 5).map(([name, count], i) => (
            <div className="background-item" key={name}>
              <div className="background-header">
                <span className="background-name">{name}</span>
                <span className="background-count">{count} CVs</span>
              </div>
              <div className="background-bar-container">
                <div
                  className="background-bar-fill"
                  style={{
                    width: `${(count / maxBg) * 100}%`,
                    backgroundColor: i === 0 ? 'var(--primary)' : NEUTRAL_RAMP[i]
                  }}
                />
              </div>
            </div>
          ))}
          {stats.topBackgrounds.length > 5 && (
            <div className="more-backgrounds">+{stats.topBackgrounds.length - 5} more backgrounds</div>
          )}
          {!stats.topBackgrounds.length && <span className="chart-empty">No backgrounds found</span>}
        </div>
      </div>
    </div>
  );
}
