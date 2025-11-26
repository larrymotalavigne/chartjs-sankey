# Examples

This directory contains example implementations of the Chart.js Sankey plugin.

## Running the Examples

### Option 1: Using a Local Server

```bash
# Using Python
python -m http.server 8000

# Using Node.js http-server
npx http-server -p 8000

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000/examples/` in your browser.

### Option 2: Using Live Server

If you're using VS Code, you can install the "Live Server" extension and right-click on `index.html` to open it with Live Server.

## Example Files

- **index.html** - Complete example showing an energy flow Sankey diagram with customization options

## Creating Your Own Example

Here's a minimal template to get started:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Sankey Example</title>
  <style>
    #myChart { max-width: 800px; height: 500px; }
  </style>
</head>
<body>
  <canvas id="myChart"></canvas>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
  <script src="../dist/chartjs-plugin-sankey.js"></script>

  <script>
    const ctx = document.getElementById('myChart').getContext('2d');
    new Chart(ctx, {
      type: 'sankey',
      data: {
        datasets: [{
          data: [
            { from: 'A', to: 'B', flow: 10 },
            { from: 'B', to: 'C', flow: 5 }
          ]
        }]
      }
    });
  </script>
</body>
</html>
```

## Generating Screenshots

To generate a screenshot for documentation:

1. Open the example in your browser
2. Take a screenshot (or use browser dev tools)
3. Save as `sankey-example.png` in this directory

Alternatively, you can use headless Chrome to generate screenshots programmatically.
