const ApiError = require("../utils/ApiError");

// Validates req.body against a zod schema and replaces it with the parsed
// (trimmed/normalized/defaulted) value so downstream code can trust its shape.
function validateBody(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(new ApiError(400, "Invalid request data.", details));
    }

    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
