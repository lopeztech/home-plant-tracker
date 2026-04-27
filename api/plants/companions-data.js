'use strict';

// Companion planting matrix — 30 common edibles with ~100 curated pairings.
// companions.json is the canonical file; this module just re-exports it.
const data = require('./companions.json');
module.exports = data;
