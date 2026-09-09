const SettingsAuditLog = require("../models/SettingsAuditLog");

// Field paths (relative to a section, e.g. "bank.accountNumber" within the
// "payments" section) whose values are never written to the audit log in
// the clear. We still record that the field changed — just not what it
// changed to/from — so the trail stays useful without holding payment
// credentials at rest in a second place.
const REDACTED_PATHS = new Set(["bank.accountNumber", "bank.ifsc", "upi.id"]);

const REDACTED = "[redacted]";

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Recursively walks `before`/`after`, emitting one {path, previousValue,
// newValue} entry per leaf (primitive or array) that actually changed.
// Nested plain objects are walked; arrays are compared wholesale (by value)
// rather than element-by-element, which is the right granularity for
// settings like tax.rates or payments.acceptedMethods.
function diffLeaves(before, after, prefix = "") {
  const changes = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const beforeValue = before?.[key];
    const afterValue = after?.[key];

    if (isPlainObject(beforeValue) || isPlainObject(afterValue)) {
      changes.push(...diffLeaves(beforeValue || {}, afterValue || {}, path));
      continue;
    }

    const unchanged = JSON.stringify(beforeValue) === JSON.stringify(afterValue);
    if (unchanged) continue;

    const redacted = REDACTED_PATHS.has(path);
    changes.push({
      path,
      previousValue: redacted ? (beforeValue === undefined ? undefined : REDACTED) : beforeValue,
      newValue: redacted ? (afterValue === undefined ? undefined : REDACTED) : afterValue,
    });
  }

  return changes;
}

// Diffs `before` vs `after` for one settings section and writes one audit
// record per changed field. Accepts an optional `session` parameter to
// participate in a MongoDB transaction — when provided, the insertMany
// runs inside the same session so the audit records commit (or abort)
// atomically with the settings mutation.
async function recordSectionChanges({ businessId, actorId, section, before, after, session }) {
  const changes = diffLeaves(before, after);

  if (changes.length === 0) {
    return [];
  }

  const records = changes.map((change) => ({
    businessId,
    actorId,
    section,
    field: change.path,
    previousValue: change.previousValue,
    newValue: change.newValue,
  }));

  const options = session ? { session } : {};
  return SettingsAuditLog.insertMany(records, options);
}

module.exports = { recordSectionChanges, diffLeaves };
