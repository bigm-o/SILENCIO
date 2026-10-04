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

// A private club's teaser: keep it out of search engines.
app.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });

// The home page, with the deployed address filled into the link-preview tags (they need an absolute URL).
app.set('trust proxy', true);
const indexHtml = fs.readFileSync(path.join(__dirname, 'site', 'index.html'), 'utf8');
app.get(['/', '/index.html'], (req, res) => {
  res.type('html').send(indexHtml.split('__ORIGIN__').join(`${req.protocol}://${req.get('host')}`));
});

app.use('/hero-options', express.static(path.join(__dirname, 'hero-options')));
app.use('/', express.static(path.join(__dirname, 'site')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
