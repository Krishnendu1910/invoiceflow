function sendSuccess(res, { statusCode = 200, message = "OK", data } = {}) {
  const body = { success: true, message };

  if (data !== undefined) {
    body.data = data;
  }

  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess };
