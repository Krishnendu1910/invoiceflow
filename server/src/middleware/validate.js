const ApiError = require("../utils/ApiError");

function issueDetails(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

// Validates req.body against a zod schema and replaces it with the parsed
// (trimmed/normalized/defaulted) value so downstream code can trust its shape.
function validateBody(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(new ApiError(400, "Invalid request data.", issueDetails(result.error)));
    }

    req.body = result.data;
    next();
  };
}

// Same idea for req.query — used by list endpoints for search/filter/pagination params.
// Express 5 exposes req.query as a getter-only accessor (recomputed from the
// URL on every read), so a plain `req.query = ...` silently no-ops instead
// of persisting the parsed value. Object.defineProperty shadows it with a
// real own property so downstream handlers see the validated data.
function validateQuery(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return next(new ApiError(400, "Invalid query parameters.", issueDetails(result.error)));
    }

    Object.defineProperty(req, "query", { value: result.data, writable: true, configurable: true, enumerable: true });
    next();
  };
}

// Same idea for req.params — used to reject malformed :id values with 400
// instead of letting an invalid ObjectId reach Mongoose as an uncaught CastError.
function validateParams(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return next(new ApiError(400, "Invalid request parameters.", issueDetails(result.error)));
    }

    req.params = result.data;
    next();
  };
}

module.exports = { validateBody, validateQuery, validateParams };
