# lboro-timetable

A script that scrapes your Loughborough University timetable directly from the official timetable page and converts it into an .ics file for easy importing into any calendar app (Google Calendar, Apple Calendar, Outlook, etc.).

## Credits

This project is based on and inspired by **[midzdotdev/timetable-vcs](https://github.com/midzdotdev/timetable-vcs)** 

The script here is functionally the exact same and was written as a personal challenge to myself to write in a more modern and modular way.
Also uses new temporal api so may only work with firefox

## Usage

1. Open your Loughborough University timetable [here](http://lucas.lboro.ac.uk/its_apx/f?p=student_timetable)

2. In the period dropdown, select **Semester 1** or **Semester 2**.

3. Right-click anywhere on the page and choose **Inspect** (or press `F12`).

4. Open the **Console** tab.

5. Paste the [script](/script.js) into the console and press **Enter**.

6. A file named **`timetable.ics`** will download automatically, simply import it into your preferred calendar app.
