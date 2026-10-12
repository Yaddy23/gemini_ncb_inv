
/**
 * Empty list state: icon + title + optional message + optional CTA.
 * Works both standalone (inside a card) and inside a table cell
 * (pass `asCell` and it renders the <tr>/<td> for you).
 */
export default function EmptyState({ icon: Icon, title, message, action, colSpan }) {
  const content = (
    <>
      {Icon && <Icon className="w-12 h-12 mx-auto mb-2 text-gray-300" />}
      <p className="font-medium text-gray-500">{title}</p>
      {message && <p className="text-sm text-gray-400 mt-1">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </>
  );

  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-6 py-10 text-center text-gray-500">
          {content}
        </td>
      </tr>
    );
  }

  return <div className="p-8 text-center text-gray-500">{content}</div>;
}

