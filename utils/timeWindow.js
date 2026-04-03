/**

* timeWindow.js
* Utility functions for handling time-based filtering of login attempts
  */

/**

* Returns timestamps within the given time window
* @param {Date[]} timestamps - Array of previous timestamps
* @param {Date} currentTime - Current log timestamp
* @param {number} windowSeconds - Time window in seconds
* @returns {Date[]} Filtered timestamps within time window
  */
  function filterByTimeWindow(timestamps, currentTime, windowSeconds) {
  const windowStart = new Date(currentTime.getTime() - windowSeconds * 1000);

  return timestamps.filter(time => time >= windowStart);
  }

/**

* Adds a new timestamp and maintains only valid timestamps within the window
* @param {Date[]} timestamps
* @param {Date} newTimestamp
* @param {number} windowSeconds
* @returns {Date[]} Updated timestamps array
  */
  function updateTimeWindow(timestamps, newTimestamp, windowSeconds) {
  if (!timestamps) timestamps = [];

  timestamps.push(newTimestamp);

  return filterByTimeWindow(timestamps, newTimestamp, windowSeconds);
  }

module.exports = {
filterByTimeWindow,
updateTimeWindow
};
