import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import { formatPhone } from "../hooks/setMobilePhone";
import { PHONE_PATTERN } from "../lib/constants";

interface PhoneInputProps {
  value: string;
  onChange: (phone: string) => void;
  onBlur: () => void;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
}

function caretAfterDigits(phone: string, nationalCount: number) {
  if (nationalCount <= 0) return 2;
  let digits = 0;
  for (let index = 0; index < phone.length; index++) {
    if (/\d/.test(phone[index])) digits += 1;
    if (digits === nationalCount + 1) return index + 1;
  }
  return phone.length;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<{ position: number } | null>(null);

  useLayoutEffect(() => {
    if (selection && inputRef.current === document.activeElement)
      inputRef.current?.setSelectionRange(
        selection.position,
        selection.position,
      );
  }, [value, selection]);

  const update = (next: string, nationalCount: number) => {
    onChange(next);
    setSelection({ position: caretAfterDigits(next, nationalCount) });
  };

  const formatInput = (raw: string, caret: number) => {
    if (/^\s*\+\s*(?!7)\d/.test(raw)) {
      update("+7", 0);
      return;
    }
    const next = formatPhone(raw) || "+7";
    const left = formatPhone(raw.slice(0, caret));
    const nationalCount = Math.max(0, left.replace(/\D/g, "").length - 1);
    update(next, nationalCount);
  };

  const removeDigits = (start: number, end: number, backward: boolean) => {
    const national = value.replace(/\D/g, "").slice(1);
    let from = Math.max(0, value.slice(0, start).replace(/\D/g, "").length - 1);
    let to = Math.max(from, value.slice(0, end).replace(/\D/g, "").length - 1);
    if (from === to && start === end) {
      if (backward) from = Math.max(0, from - 1);
      else to = Math.min(national.length, to + 1);
    }
    const remaining = national.slice(0, from) + national.slice(to);
    update(formatPhone(`+7${remaining}`) || "+7", from);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    event.preventDefault();
    const input = event.currentTarget;
    const backward = event.key === "Backspace";
    let start = input.selectionStart ?? value.length;
    let end = input.selectionEnd ?? start;
    if (event.ctrlKey || event.metaKey || event.altKey) {
      if (backward) start = 2;
      else end = value.length;
    }
    removeDigits(start, end, backward);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const caret = input.selectionStart ?? input.value.length;
    const inputType = (event.nativeEvent as InputEvent).inputType;
    const deletingBackward = inputType === "deleteContentBackward";
    const deletingForward = inputType === "deleteContentForward";
    if (
      (deletingBackward || deletingForward) &&
      input.value.length < value.length &&
      input.value.replace(/\D/g, "") === value.replace(/\D/g, "")
    ) {
      const previousCaret = caret + Number(deletingBackward);
      removeDigits(previousCaret, previousCaret, deletingBackward);
      return;
    }
    formatInput(input.value, caret);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!pasted) return;
    event.preventDefault();
    const input = event.currentTarget;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    if (
      pasted.replace(/\D/g, "").length >= 10 ||
      /^\s*\+/.test(pasted) ||
      value.replace(/\D/g, "").length <= 1 ||
      (start <= 2 && end === value.length)
    ) {
      formatInput(pasted, pasted.length);
      return;
    }
    const next = value.slice(0, start) + pasted + value.slice(end);
    formatInput(next, start + pasted.length);
  };

  return (
    <input
      ref={inputRef}
      type="tel"
      name="phone"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={() => {
        if (!value) update("+7", 0);
      }}
      onSelect={(event) => {
        const input = event.currentTarget;
        if (
          input.selectionStart === input.selectionEnd &&
          (input.selectionStart ?? 2) < 2
        )
          input.setSelectionRange(2, 2);
      }}
      onBlur={onBlur}
      placeholder="+7 (999) 123-45-67"
      maxLength={18}
      pattern={PHONE_PATTERN}
      required
      autoComplete="tel"
      inputMode="tel"
      aria-label="Телефон"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      disabled={disabled}
    />
  );
}
