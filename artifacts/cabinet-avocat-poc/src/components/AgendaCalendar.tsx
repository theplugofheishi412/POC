import { Fragment, useState, type DragEvent } from 'react';
import { CalendarDays, GripVertical } from 'lucide-react';

export type AgendaCalendarEvent = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date: string;
  kind: string;
  calendarDay: number;
  calendarTime: string;
};

type AgendaCalendarProps = {
  events: AgendaCalendarEvent[];
  onMove: (eventId: string, day: number, time: string) => void;
  onSelect: (event: AgendaCalendarEvent) => void;
};

const days = [
  { label: 'Lun.', day: 16 },
  { label: 'Mar.', day: 17 },
  { label: 'Mer.', day: 18 },
  { label: 'Jeu.', day: 19 },
  { label: 'Ven.', day: 20 },
  { label: 'Sam.', day: 21 },
  { label: 'Dim.', day: 22 },
];

const slots = Array.from({ length: 20 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
  const minute = String(minutes % 60).padStart(2, '0');
  return `${hour}:${minute}`;
});

const dayNames: Record<number, string> = {
  16: 'lundi',
  17: 'mardi',
  18: 'mercredi',
  19: 'jeudi',
  20: 'vendredi',
  21: 'samedi',
  22: 'dimanche',
};

export default function AgendaCalendar({
  events,
  onMove,
  onSelect,
}: AgendaCalendarProps) {
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    eventId: string,
  ) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', eventId);
    setDraggedEventId(eventId);
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    day: number,
    time: string,
  ) => {
    event.preventDefault();
    const eventId = event.dataTransfer.getData('text/plain') || draggedEventId;
    if (!eventId) return;

    onMove(eventId, day, time);
    setDraggedEventId(null);
    setHoveredSlot(null);
  };

  return (
    <section
      className="panel agenda-calendar"
      aria-label="Calendrier hebdomadaire de démonstration"
      data-testid="agenda-week-calendar"
    >
      <div className="panel-head agenda-calendar-heading">
        <div>
          <h2 className="panel-title">Semaine du 16 au 22 juin 2025</h2>
          <div className="panel-caption">Un aperçu des rendez-vous du cabinet</div>
        </div>
        <span className="agenda-week-badge"><CalendarDays /> Semaine</span>
      </div>

      <div className="agenda-calendar-instruction">
        <span className="agenda-drag-hint"><GripVertical /> Faites glisser un rendez-vous vers un autre jour ou horaire.</span>
        <span className="agenda-demo-hint">Déplacement temporaire · données fictives</span>
      </div>

      <div className="agenda-calendar-scroll">
        <div className="agenda-week-grid">
          <div className="agenda-grid-corner">HEURE</div>
          {days.map(({ label, day }) => (
            <div
              className={`agenda-day-heading ${day === 17 ? 'is-today' : ''}`}
              key={day}
            >
              <span>{label}</span>
              <strong>{day}</strong>
              {day === 17 && <small>Aujourd’hui</small>}
            </div>
          ))}

          {slots.map((time) => (
            <Fragment key={time}>
              <div className={`agenda-time-label ${time.endsWith(':00') ? 'is-hour' : ''}`}>
                {time}
              </div>
              {days.map(({ day }) => {
                const slotId = `${day}-${time}`;
                const slotEvents = events.filter(
                  (item) => item.calendarDay === day && item.calendarTime === time,
                );
                return (
                  <div
                    className={`agenda-drop-slot ${time.endsWith(':00') ? 'is-hour' : ''} ${hoveredSlot === slotId ? 'is-drop-target' : ''}`}
                    key={slotId}
                    aria-label={`${dayNames[day]} ${day} juin à ${time}`}
                    data-testid={`agenda-drop-${slotId}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setHoveredSlot(slotId);
                    }}
                    onDragLeave={() => setHoveredSlot((current) => current === slotId ? null : current)}
                    onDrop={(event) => handleDrop(event, day, time)}
                  >
                    {slotEvents.map((item) => (
                      <button
                        className={`agenda-event ${draggedEventId === item.id ? 'is-dragging' : ''}`}
                        key={item.id}
                        type="button"
                        draggable
                        aria-label={`Déplacer ou consulter ${item.title}, ${dayNames[day]} ${day} juin à ${time}`}
                        data-testid={`agenda-event-${item.id}`}
                        onDragStart={(event) => handleDragStart(event, item.id)}
                        onDragEnd={() => {
                          setDraggedEventId(null);
                          setHoveredSlot(null);
                        }}
                        onClick={() => onSelect(item)}
                      >
                        <span className="agenda-event-time">{time}</span>
                        <strong>{item.title}</strong>
                        <small>{item.kind}</small>
                      </button>
                    ))}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="agenda-calendar-footer">
        <span>{events.length} rendez-vous affiché{events.length > 1 ? 's' : ''}</span>
        <span>Les changements ne sont pas enregistrés.</span>
      </div>
    </section>
  );
}
