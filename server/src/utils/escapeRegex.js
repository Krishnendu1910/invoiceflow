// Escapes regex metacharacters in user-supplied search text before it is
// used to build a MongoDB $regex filter, so a search term like "a.b(" can't
// be interpreted as a pattern.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = escapeRegex;
