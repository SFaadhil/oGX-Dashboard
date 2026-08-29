// Shared option lists for AIESEC in India oGX.

export const PRODUCTS = [
  { value: 'GTa', label: 'GTa' },
  { value: 'GTe', label: 'GTe' }
];

export const PRODUCT_COLORS = {
  GTa: '#520305',
  GTe: '#fceb04'
};

export const YEARS = [
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
  { value: '5', label: 'Year 5' },
  { value: 'Graduate', label: 'Graduate' }
];

export const REGIONS = [
  { value: 'Asia-Pacific', label: 'Asia-Pacific' },
  { value: 'Europe', label: 'Europe' },
  { value: 'Americas', label: 'Americas' },
  { value: 'Africa', label: 'Africa' },
  { value: 'Middle East', label: 'Middle East' }
];

export const DURATIONS = [
  { value: 'Short Term', label: 'Short (8-12 weeks)' },
  { value: 'Mid Term', label: 'Mid (3-6 months)' },
  { value: 'Long Term', label: 'Long (6-18 months)' }
];

export const LEAD_STATUSES = [
  { value: 'Not Contacted', label: 'Not Contacted' },
  { value: 'Contacted', label: 'Contacted' },
  { value: 'Interested', label: 'Interested' },
  { value: 'Not Interested', label: 'Not Interested' },
  { value: 'Applied', label: 'Applied' },
  { value: 'Approved', label: 'Approved' }
];

export const STATUS_TONE = {
  'Not Contacted': 'badge-neutral',
  Contacted: 'badge-info',
  Interested: 'badge-success',
  'Not Interested': 'badge-danger',
  Applied: 'badge-warning',
  Approved: 'badge-success'
};

export const FEEDBACK_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
];

export const PRIORITIES = [
  { value: 'Urgent', label: 'Urgent' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Default', label: 'Default' }
];

export const OGT_TEAMS = [
  { value: 'oGT 1', label: 'oGT 1' },
  { value: 'oGT 2', label: 'oGT 2' }
];

export const KEY_AREAS = [
  'LCVP oGX',
  'oGX Team Leader',
  'oGX Operations',
  'oGX Quality',
  'oGX Matching',
  'oGX Marketing',
  'IR Responsible',
  'Administrator'
];

// Roles that unlock organisation-wide views.
export const VP_KEY_AREAS = ['LCVP oGX', 'Administrator'];
export const TEAM_LEADER_KEY_AREAS = ['oGX Team Leader', ...VP_KEY_AREAS];

export const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
  { value: 'Prefer not to say', label: 'Prefer not to say' }
];

export const DATE_RANGES = [
  { value: 'all', label: 'All Dates' },
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' }
];

export const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Benin', 'Bolivia',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde',
  'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia',
  'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'DRC', 'Denmark',
  'Djibouti', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea',
  'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia',
  'Germany', 'Ghana', 'Greece', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Haiti', 'Honduras',
  'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
  'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Lithuania', 'Luxembourg', 'Madagascar',
  'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Mauritania', 'Mauritius', 'Mexico', 'Moldova',
  'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nepal',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Macedonia', 'Norway', 'Oman',
  'Pakistan', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Puerto Rico', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Senegal',
  'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Somalia',
  'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo',
  'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Venezuela',
  'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
].map((c) => ({ value: c, label: c }));

// Seed list used when the backgrounds table has not been populated yet.
export const DEFAULT_BACKGROUNDS = [
  'Accounting', 'Agriculture', 'Architecture', 'Arts', 'Bioengineering', 'Business administration',
  'Chemistry', 'Civil engineering', 'Communication & journalism', 'Computer engineering',
  'Computer sciences', 'Economics', 'Education', 'Electrical engineering', 'Environmental science',
  'Finance', 'Health sciences', 'History', 'Human Resources', 'Industrial Design',
  'International relations', 'Languages', 'Law', 'Linguistics', 'Literature', 'Marketing',
  'Mathematics', 'Mechanical engineering', 'Medicine', 'Nursing', 'Nutrition', 'Other', 'Pharmacy',
  'Philosophy', 'Physics', 'Political science', 'Psychology', 'Public relations', 'Sales',
  'Social work', 'Sociology', 'Software development and programming', 'Sports', 'Statistics',
  'Systems and Computing Engineering', 'Tourism & hospitality'
];
