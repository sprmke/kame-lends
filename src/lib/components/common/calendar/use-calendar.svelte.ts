import type { CalendarCell, CalendarEvent, ViewMode } from "./types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function createCalendarState(getEvents: () => CalendarEvent[]) {
  let currentDate = $state(new Date());
  let viewMode = $state<ViewMode>(
    typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
      ? "day"
      : "month",
  );

  function isToday(date: Date) {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  const calendarData = $derived.by((): CalendarCell[] => {
    const events = getEvents();
    const grid: CalendarCell[] = [];

    if (viewMode === "day") {
      grid.push({
        date: new Date(currentDate),
        isCurrentMonth: true,
        events: [],
      });
    } else if (viewMode === "week") {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        grid.push({
          date,
          isCurrentMonth: date.getMonth() === currentDate.getMonth(),
          events: [],
        });
      }
    } else {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const firstDayOfWeek = firstDay.getDay();
      const daysInMonth = lastDay.getDate();
      const daysFromPrevMonth = firstDayOfWeek;
      const totalCells = Math.ceil((daysFromPrevMonth + daysInMonth) / 7) * 7;
      const daysFromNextMonth = totalCells - daysFromPrevMonth - daysInMonth;

      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
        const date = new Date(year, month - 1, prevMonthLastDay - i);
        grid.push({
          date,
          isCurrentMonth: false,
          events: [],
        });
      }

      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        grid.push({
          date,
          isCurrentMonth: true,
          events: [],
        });
      }

      for (let i = 1; i <= daysFromNextMonth; i++) {
        const date = new Date(year, month + 1, i);
        grid.push({
          date,
          isCurrentMonth: false,
          events: [],
        });
      }
    }

    events.forEach((event) => {
      grid.forEach((cell) => {
        const cellDate = new Date(cell.date);
        cellDate.setHours(0, 0, 0, 0);

        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);

        if (cellDate.getTime() === eventDate.getTime()) {
          cell.events.push(event);
        }
      });
    });

    return grid;
  });

  function goToPreviousPeriod() {
    if (viewMode === "day") {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() - 1,
      );
    } else if (viewMode === "week") {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() - 7,
      );
    } else {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1,
      );
    }
  }

  function goToNextPeriod() {
    if (viewMode === "day") {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() + 1,
      );
    } else if (viewMode === "week") {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate() + 7,
      );
    } else {
      currentDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1,
      );
    }
  }

  function goToToday() {
    currentDate = new Date();
  }

  function getViewTitle() {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    if (viewMode === "week") {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      return `${weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${weekEnd.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    }

    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }

  function setViewMode(mode: ViewMode) {
    const shell =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches;
    viewMode = shell && mode !== "day" ? "day" : mode;
  }

  if (typeof window !== "undefined") {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => {
      if (mql.matches && viewMode !== "day") viewMode = "day";
    };
    mql.addEventListener("change", onChange);
  }

  return {
    get currentDate() {
      return currentDate;
    },
    get viewMode() {
      return viewMode;
    },
    setViewMode,
    get calendarData() {
      return calendarData;
    },
    goToPreviousPeriod,
    goToNextPeriod,
    goToToday,
    getViewTitle,
    monthNames: MONTH_NAMES,
    dayNames: DAY_NAMES,
    isToday,
  };
}
