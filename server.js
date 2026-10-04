const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.get('/_debug', (req, res) => {
  const siteAssets = path.join(__dirname, 'site', 'assets');
  try {
    const top = fs.readdirSync(path.join(__dirname));
    const site = fs.readdirSync(path.join(__dirname, 'site'));
    const assets = fs.existsSync(siteAssets) ? fs.readdirSync(siteAssets) : 'MISSING';
    res.json({ root: top, site, assets });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.use('/hero-options', express.static(path.join(__dirname, 'hero-options')));
app.use('/', express.static(path.join(__dirname, 'site')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
