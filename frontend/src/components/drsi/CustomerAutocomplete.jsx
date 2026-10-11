import React, { useEffect, useRef, useState } from 'react';
import { Loader } from 'lucide-react';
import { customerApi } from '../../api/customer';

// Debounced, cancellable customer name autocomplete with dropdown suggestions.
// Controlled: the parent owns the name; onSelect hands back the full customer
// so the parent can fill the remembered address.
const CustomerAutocomplete = ({
  value,
  onNameChange,
  onSelect,
  disabled = false,
  hasError = false,
  placeholder = 'Customer name',
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const timerRef = useRef(null);
  const seqRef = useRef(0);

  // Clear pending debounce on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Cancel any pending/in-flight search and close the dropdown. Bumping the
  // sequence makes an in-flight response stale so it can't reopen the list.
  const dismissSuggestions = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    seqRef.current++;
    setLoading(false);
    setOpen(false);
    setSuggestions([]);
    setHighlightIndex(-1);
  };

  const handleNameChange = (name) => {
    onNameChange(name);

    if (timerRef.current) clearTimeout(timerRef.current);
    const clean = name.trim();

    if (clean.length < 2) {
      // Invalidate any in-flight search (stale responses are discarded)
      seqRef.current++;
      setLoading(false);
      setOpen(false);
      setSuggestions([]);
      setHighlightIndex(-1);
      return;
    }

    // Debounce: search after the user pauses typing (~300ms)
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      const seq = ++seqRef.current;

      setLoading(true);
      try {
        const response = await customerApi.getCustomers({
          search: clean,
          isActive: true,
          limit: 8,
          sort: 'name',
        });
        // Discard stale responses - a newer keystroke started another search
        if (seqRef.current !== seq) return;

        const matches = response.data.customers || [];
        setSuggestions(matches);
        setHighlightIndex(matches.length > 0 ? 0 : -1);
        setOpen(true);
      } catch (err) {
        if (seqRef.current !== seq) return;
        setSuggestions([]);
        setHighlightIndex(-1);
        setOpen(false);
      } finally {
        if (seqRef.current === seq) setLoading(false);
      }
    }, 300);
  };

  const selectCustomer = (customer) => {
    // Cancel the pending debounce so an in-flight response can't reopen the
    // list after a pick
    dismissSuggestions();
    onNameChange(customer.name);
    if (onSelect) onSelect(customer);
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault();
        selectCustomer(suggestions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      dismissSuggestions();
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onChange={(e) => handleNameChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={dismissSuggestions}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-9 ${
          hasError ? 'border-red-500' : 'border-gray-300'
        }`}
        placeholder={placeholder}
        disabled={disabled}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Loader className="w-4 h-4 animate-spin text-primary" />
        </div>
      )}

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((customer, index) => (
            <li
              key={customer._id}
              role="option"
              aria-selected={index === highlightIndex}
              // Prevent blur before the click registers
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlightIndex(index)}
              onClick={() => selectCustomer(customer)}
              className={`px-3 py-2 cursor-pointer ${index === highlightIndex ? 'bg-primary/5' : ''}`}
            >
              <p className="text-sm font-medium text-gray-900 truncate">{customer.name}</p>
              {customer.address && (
                <p className="text-xs text-gray-500 truncate">{customer.address}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomerAutocomplete;
