// Shared shape for turning an API error response into form field errors and
// a top-level message, used by every Customer/Item form.
export function parseFieldErrors(err) {
  const details = err.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return details.reduce((acc, d) => {
    acc[d.field] = d.message;
    return acc;
  }, {});
}

export function parseErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  return err.response?.data?.message || fallback;
}
