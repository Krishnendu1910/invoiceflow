// Drops undefined/null/"" values so list calls don't send e.g. "search=" or
// "type=undefined" to the API.
export function toQueryString(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      usp.set(key, value);
    }
  });
  return usp.toString();
}
