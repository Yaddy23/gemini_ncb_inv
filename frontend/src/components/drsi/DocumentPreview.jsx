import React from 'react';
import { FileText } from 'lucide-react';
import { formatDate, formatCurrency } from '../../utils/numberToWords';
import { StatusBadge, Modal } from '../ui';

const TYPE_NAMES = {
  DR: 'Delivery Receipt',
  SI: 'Sales Invoice',
  EF: 'Evaluation Form'
};

const DocumentPreview = ({ document, documentType, onClose }) => {
  if (!document) return null;

  const doc = document;
  const isSI = documentType === 'SI';
  const title = TYPE_NAMES[documentType] || 'Document';
  const docNumber = doc.drNumber || doc.siNumber || doc.efNumber || '—';

  const items = doc.items || [];
  const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || (Number(item.qty) || 0) * (Number(item.unitPrice) || 0)), 0);
  const discountPercentage = Number(doc.discountPercentage) || 0;
  const discount = isSI ? subtotal * discountPercentage / 100 : 0;
  const total = isSI ? subtotal - discount : subtotal;

  const getStatusBadge = (status) => <StatusBadge status={status} />;

  return (
    <Modal
      open
      onClose={onClose}
      size="2xl"
      title={
        <span className="flex items-center space-x-2">
          <FileText className="w-6 h-6 text-primary" />
          <span>{title}</span>
        </span>
      }
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 touch-manipulation min-h-[44px]"
        >
          Close
        </button>
      }
    >
      <div>
          {doc.status === 'cancelled' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-bold text-red-800">CANCELLED</p>
              {doc.cancelReason && <p className="text-sm text-red-700 mt-1">Reason: {doc.cancelReason}</p>}
              {doc.cancelledAt && <p className="text-sm text-red-600 mt-1">Cancelled on {formatDate(doc.cancelledAt)}</p>}
            </div>
          )}

          <div className="flex items-center justify-end mb-4">
            {getStatusBadge(doc.status)}
          </div>

          {/* Header grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase">{title} Number</p>
              <p className="text-sm font-medium text-gray-900 font-mono">{docNumber}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase">Date</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(doc.date)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase">Customer Name</p>
              <p className="text-sm font-medium text-gray-900">{doc.customerName || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase">Customer Address</p>
              <p className="text-sm font-medium text-gray-900">{doc.customerAddress || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase">Requested By</p>
              <p className="text-sm font-medium text-gray-900">{doc.marketingExecutive?.name || '—'}</p>
            </div>
            {isSI && (
              <>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase">P.O. Number</p>
                  <p className="text-sm font-medium text-gray-900 font-mono">{doc.poNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase">Discount %</p>
                  <p className="text-sm font-medium text-gray-900">{doc.discountPercentage || 0}%</p>
                </div>
              </>
            )}
          </div>

          {/* Items table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ISBN</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-sm text-gray-500 text-center">No items</td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 font-mono">{item.isbn || '—'}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{item.title || '—'}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 text-right">{item.qty}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(Number(item.amount) || (Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-sm font-medium text-gray-700 text-right">Subtotal</td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(subtotal)}</td>
                </tr>
                {isSI && (
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-sm font-medium text-gray-700 text-right">Discount ({discountPercentage}%)</td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(discount)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-sm font-bold text-gray-900 text-right">Total</td>
                  <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

        {/* Created by */}
        <p className="mt-4 text-xs text-gray-400">Created by {doc.createdBy?.username || '—'} on {formatDate(doc.createdAt)}</p>
      </div>
    </Modal>
  );
};

export default DocumentPreview;
