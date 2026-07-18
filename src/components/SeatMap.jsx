import React, { useMemo } from "react";
import { SEAT_LAYOUT, buildSeatMap } from "../data/content.js";

export default function SeatMap({ fareId, departureIndex, maxSeats, selected, onToggle, t }) {
  const seats = useMemo(() => buildSeatMap(fareId, departureIndex), [fareId, departureIndex]);
  const rows = useMemo(() => {
    const grouped = {};
    seats.forEach((seat) => {
      grouped[seat.row] = grouped[seat.row] || [];
      grouped[seat.row].push(seat);
    });
    return grouped;
  }, [seats]);

  return (
    <div className="seat-map-wrap">
      <div className="seat-map">
        <div className="seat-driver">
          <span>{t.driver}</span>
        </div>
        {Object.keys(rows)
          .map(Number)
          .sort((a, b) => a - b)
          .map((rowNumber) => (
            <div className="seat-row" key={rowNumber}>
              {SEAT_LAYOUT.map((col, colIndex) =>
                col ? (
                  (() => {
                    const seat = rows[rowNumber].find((item) => item.col === col);
                    const isSelected = selected.includes(seat.id);
                    const disabled = seat.taken || (!isSelected && selected.length >= maxSeats);
                    return (
                      <button
                        aria-label={`Seat ${seat.id}`}
                        aria-pressed={isSelected}
                        className={[
                          "seat",
                          seat.taken ? "taken" : "",
                          seat.premium ? "premium" : "",
                          isSelected ? "selected" : "",
                        ]
                          .join(" ")
                          .trim()}
                        disabled={seat.taken}
                        key={seat.id}
                        onClick={() => !disabled && onToggle(seat)}
                        type="button"
                      >
                        {seat.id}
                      </button>
                    );
                  })()
                ) : (
                  <span className="seat-aisle" key={`aisle-${rowNumber}-${colIndex}`} />
                ),
              )}
            </div>
          ))}
      </div>
      <div className="seat-legend">
        <span>
          <i className="seat-dot available" />
          {t.seatAvailable}
        </span>
        <span>
          <i className="seat-dot selected" />
          {t.seatPicked}
        </span>
        <span>
          <i className="seat-dot premium" />
          {t.seatPremium}
        </span>
        <span>
          <i className="seat-dot taken" />
          {t.seatTaken}
        </span>
      </div>
    </div>
  );
}
