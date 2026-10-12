/*
 * Reference diagrams for the visual regression suite (scripts/visual-test.mjs).
 * Each fixture is rendered in headless Chromium and compared pixel by pixel
 * with test/visual/__snapshots__/<name>.png.
 *
 * Labels are hidden in most fixtures: text rendering depends on the fonts
 * installed on the machine, shapes and colors do not. `labels` keeps one
 * fixture with text, compared with a looser tolerance.
 */
const energy = [
  { from: 'Oil', to: 'Energy', flow: 35 },
  { from: 'Gas', to: 'Energy', flow: 23 },
  { from: 'Coal', to: 'Energy', flow: 25 },
  { from: 'Renewable', to: 'Energy', flow: 17 },
  { from: 'Energy', to: 'Industry', flow: 40 },
  { from: 'Energy', to: 'Transport', flow: 30 },
  { from: 'Energy', to: 'Residential', flow: 20 },
  { from: 'Energy', to: 'Commercial', flow: 10 }
];

const budget = [
  { from: 'Budget', to: 'Development', flow: 50 },
  { from: 'Budget', to: 'Marketing', flow: 30 },
  { from: 'Budget', to: 'Operations', flow: 20 },
  { from: 'Development', to: 'Frontend', flow: 30 },
  { from: 'Development', to: 'Backend', flow: 20 },
  { from: 'Marketing', to: 'Digital', flow: 20 },
  { from: 'Marketing', to: 'Traditional', flow: 10 }
];

const journey = [
  { from: 'Website', to: 'Product', flow: 1000 },
  { from: 'Social', to: 'Product', flow: 500 },
  { from: 'Product', to: 'Cart', flow: 600 },
  { from: 'Product', to: 'Exit', flow: 900 },
  { from: 'Cart', to: 'Checkout', flow: 400 },
  { from: 'Cart', to: 'Exit', flow: 200 },
  { from: 'Checkout', to: 'Purchase', flow: 350 }
];

const cycle = [
  { from: 'Visit', to: 'Signup', flow: 50 },
  { from: 'Signup', to: 'Active', flow: 40 },
  { from: 'Active', to: 'Churn', flow: 15 },
  { from: 'Churn', to: 'Visit', flow: 10 },
  { from: 'Active', to: 'Paid', flow: 25 },
  { from: 'Active', to: 'Signup', flow: 5 }
];

const noLabels = { labels: { display: false } };

export const fixtures = [
  { name: 'energy-default', width: 600, height: 360, dataset: { data: energy, ...noLabels } },
  {
    name: 'budget-gradient',
    width: 600,
    height: 360,
    dataset: {
      data: budget,
      colorMode: 'gradient',
      nodeColors: { Budget: '#3f51b5', Development: '#2196f3', Marketing: '#e91e63', Operations: '#009688' },
      ...noLabels
    }
  },
  {
    name: 'journey-styled',
    width: 600,
    height: 360,
    dataset: {
      data: journey,
      colorMode: 'to',
      nodeBorderColor: '#000',
      nodeBorderWidth: 1,
      nodeBorderRadius: 6,
      nodeWidth: 24,
      ...noLabels
    }
  },
  { name: 'vertical', width: 400, height: 500, dataset: { data: budget, orientation: 'vertical', ...noLabels } },
  { name: 'cycles', width: 600, height: 360, dataset: { data: cycle, ...noLabels } },
  { name: 'cycles-vertical', width: 400, height: 500, dataset: { data: cycle, orientation: 'vertical', ...noLabels } },
  { name: 'energy-hidpi', width: 600, height: 360, dpr: 2, dataset: { data: energy, ...noLabels } },
  { name: 'labels', width: 600, height: 360, tolerance: 0.02, dataset: { data: energy } }
];
