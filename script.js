(function() {
  const Config = {
    selectors: {
      periodDropdown: '#P2_MY_PERIOD',
      rows: '.tt_info_row',
      firstSlot: '.first_time_slot_col',
      weekday: '.weekday',
      cells: 'td:not(.weekday_col)',
      sessionCells: '.tt_info_cell, .new_row_tt_info_cell',
      onDemand: '.tt_content.on_demand',
      room: '.tt_room_row',
      building: '.tt_room_row + .tt_room_row',
      moduleName: '.tt_module_name_row',
      moduleType: '.tt_modtype_row',
      weeks: '.tt_weeks_row',
      lecturer: '.tt_lect_row',
      moduleId: '.tt_module_id_row',
    },
    patterns: {
      semesterWeek: /Wk (\d+).*starting (\d+-[A-Z]+-\d+)/,
      weekRange: /Sem\s+\d:\s+(.*)$/,
      cleanText: /\.{3,}|[()]/g,
    },
    consts: {
      slotMinutes: 30,
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    }
  };

  const Utils = {
    text: (el, selector) => el.querySelector(selector)?.textContent.trim() ?? '',

    clean: (str) => str?.replace(Config.patterns.cleanText, '').trim() || '',

    toICS: (temporalObj) => {
      return temporalObj.toString({ smallestUnit: 'second' }).replace(/[-:]/g, '');
    },

    parseWeeks: (weekStr) => {
      const rangeStr = (weekStr.match(Config.patterns.weekRange) ?? [])[1];
      if (!rangeStr) return [];

      return rangeStr.split(',').flatMap(part => {
        const [start, end] = part.split('-').map(Number);
        return end
          ? Array.from({ length: end - start + 1 }, (_, i) => start + i)
          : [start];
      });
    }
  };

  const DomParser = {
    getSemesterInfo() {
      const dropdown = document.querySelector(Config.selectors.periodDropdown);
      if (!dropdown?.value.startsWith('sem')) throw new Error('Please select Semester 1 or 2.');

      const semester = dropdown.value === 'sem1' ? 1 : 2;

      const weekMap = new Map(
        [...dropdown.options]
          .filter(opt => opt.text.includes(`Sem ${semester} - Wk`))
          .map(opt => {
            const match = Config.patterns.semesterWeek.exec(opt.text);
            if (!match) return null;
            return [parseInt(match[1]), Temporal.PlainDate.from(new Date(match[2]).toISOString().split('T')[0])];
          })
          .filter(Boolean)
      );

      return { weekMap };
    },
    getStartTime() {
      const el = document.querySelector(Config.selectors.firstSlot);
      const rawText = el?.textContent?.trim() ?? '9';
      const hour = parseInt(rawText, 10);
      return Temporal.PlainTime.from({ hour: hour, minute: 0 });
    },

    getDayIndex(row) {
      let curr = row;
      while (curr && !curr.querySelector(Config.selectors.weekday)) {
        curr = curr.previousElementSibling;
      }
      return curr
        ? Config.consts.days.indexOf(curr.querySelector(Config.selectors.weekday).textContent.trim())
        : -1;
    }
  };

  try {
    const { weekMap } = DomParser.getSemesterInfo();
    const startTime = DomParser.getStartTime();
    const rows = document.querySelectorAll(Config.selectors.rows);

    const events = [...rows].flatMap(row => {
      const dayIndex = DomParser.getDayIndex(row);
      if (dayIndex === -1) return [];

      let timeOffset = Temporal.Duration.from('PT0M');

      return [...row.cells]
        .filter(td => !td.classList.contains('weekday_col'))
        .flatMap(cell => {
          const slots = parseInt(cell.getAttribute('colspan')) || 1;

          const totalMinutes = slots * Config.consts.slotMinutes;
          const cellDuration = Temporal.Duration.from({ minutes: totalMinutes });

          const currentOffset = timeOffset;
          timeOffset = timeOffset.add(cellDuration);

          const isSession = cell.matches(Config.selectors.sessionCells);
          const isOnDemand = cell.querySelector(Config.selectors.onDemand);

          if (!isSession || isOnDemand) return [];

          const [roomRaw, buildRaw] = cell.querySelectorAll(Config.selectors.room);
          const room = Utils.clean(roomRaw?.textContent) || 'Online';
          const building = Utils.clean(buildRaw?.textContent);
          const weeksRaw = Utils.text(cell, Config.selectors.weeks);
          const moduleName = Utils.text(cell, Config.selectors.moduleName);
          const moduleType = Utils.text(cell, Config.selectors.moduleType);
          const lecturer = Utils.text(cell, Config.selectors.lecturer);
          const moduleId = Utils.text(cell, Config.selectors.moduleId);
          const activeWeeks = Utils.parseWeeks(weeksRaw);

          return activeWeeks.map(weekNum => {
            if (!weekMap.has(weekNum)) return null;

            const weekStartDate = weekMap.get(weekNum);
            const date = weekStartDate.add({ days: dayIndex });
            const startDateTime = date.toPlainDateTime(startTime).add(currentOffset);
            const endDateTime = startDateTime.add(cellDuration);

            return {
              uid: `${Utils.toICS(startDateTime)}-${moduleId}@lboro`,
              stamp: Utils.toICS(Temporal.Now.zonedDateTimeISO('UTC')),
              start: Utils.toICS(startDateTime),
              end: Utils.toICS(endDateTime),
              summary: moduleName,
              location: room === 'Online' ? 'Online' : `${room} (${building})`,
              description: `${moduleName} (${moduleType}) with ${lecturer} in ${room} ${building}`
            };
          }).filter(Boolean);
        });
    });

    if (!events.length) throw new Error('No sessions found.');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lboro Timetable Scraper (Temporal)//EN',
      ...events.map(e => [
        'BEGIN:VEVENT',
        `UID:${e.uid}`,
        `DTSTAMP:${e.stamp}Z`,
        `DTSTART:${e.start}`,
        `DTEND:${e.end}`,
        `SUMMARY:${e.summary}`,
        `LOCATION:${e.location}`,
        `DESCRIPTION:${e.description.replace(/\n/g, '\\n')}`,
        'END:VEVENT'
      ].join('\r\n')),
      'END:VCALENDAR'
    ].join('\r\n');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([icsContent], { type: 'text/calendar' }));
    link.download = 'timetable.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

  } catch (err) {
    alert(err.message);
    console.error(err);
  }
})();
