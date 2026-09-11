const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const documentService = require("../services/document.service");

const create = asyncHandler(async (req, res) => {
  const document = await documentService.createDocument(req.user._id, req.businessId, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: "Document created.",
    data: { document },
  });
});

const getById = asyncHandler(async (req, res) => {
  const document = await documentService.getDocumentById(req.user._id, req.params.id);
  return sendSuccess(res, { data: { document } });
});

const list = asyncHandler(async (req, res) => {
  const { documents, pagination } = await documentService.listDocuments(req.user._id, req.businessId, req.query);
  return sendSuccess(res, { data: { documents, pagination } });
});

const update = asyncHandler(async (req, res) => {
  const document = await documentService.updateDraftDocument(req.user._id, req.params.id, req.body);
  return sendSuccess(res, {
    message: "Document updated.",
    data: { document },
  });
});

const deleteDraft = asyncHandler(async (req, res) => {
  const result = await documentService.deleteDraftDocument(req.user._id, req.params.id);
  return sendSuccess(res, {
    message: "Document deleted.",
    data: result,
  });
});

const transitionStatus = asyncHandler(async (req, res) => {
  const document = await documentService.transitionDocumentStatus(req.user._id, req.params.id, req.body.status);
  return sendSuccess(res, {
    message: `${document.type === "quotation" ? "Quotation" : "Invoice"} status updated.`,
    data: { document },
  });
});

const convertToInvoice = asyncHandler(async (req, res) => {
  const { invoice, quotation } = await documentService.convertQuotationToInvoice(req.user._id, req.params.id);
  return sendSuccess(res, {
    statusCode: 201,
    message: "Quotation converted to invoice successfully.",
    data: {
      document: invoice,
      invoice,
      quotation,
    },
  });
});

module.exports = {
  create,
  getById,
  list,
  update,
  deleteDraft,
  transitionStatus,
  convertToInvoice,
};


