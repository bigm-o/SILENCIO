const express = require('express');
const path = require('path');
const app = express();

app.use('/hero-options', express.static(path.join(__dirname, 'hero-options')));
app.use('/', express.static(path.join(__dirname, 'site')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
