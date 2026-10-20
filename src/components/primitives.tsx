"use client";
import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      d?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""} ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="modal-heading">
        <h2>{title}</h2>
        <button
          onClick={onClose}
          aria-label={`关闭${title}`}
          className="icon-button"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </header>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}
export function Meter({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <span>
          {value}
          <small>/100</small>
        </span>
      </div>
      <div className="meter-track">
        <span
          style={{
            width: `${value}%`,
            background: warning ? "var(--danger)" : undefined,
          }}
        />
      </div>
    </div>
  );
}
export function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}
