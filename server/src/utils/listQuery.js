// Shared helpers for the Customer/Item list endpoints, which both page and
// sort the same way.

// `_id` is always appended as a tiebreaker so pagination stays deterministic
// even when many rows share the same value for the sorted field (e.g. rate).
function buildSort(sort) {
  const direction = sort.startsWith("-") ? -1 : 1;
  const field = sort.replace(/^-/, "");
  return { [field]: direction, _id: 1 };
}

function buildPagination(page, limit) {
  return { skip: (page - 1) * limit, limit };
}

module.exports = { buildSort, buildPagination };
