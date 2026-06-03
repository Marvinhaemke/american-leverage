// Client-side helper that fires a Meta Pixel event and the matching
// server-side CAPI event with the same `event_id` for deduplication.
(function () {
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : '';
  }

  function sendCapi(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon('/api/meta-capi', blob)) return;
      }
      fetch('/api/meta-capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function (err) { console.warn('CAPI error:', err); });
    } catch (err) {
      console.warn('CAPI dispatch failed:', err);
    }
  }

  // Fires the Pixel event AND the CAPI event with the same event_id.
  // user: { email, phone, name, first_name, last_name, country }
  // customData: { content_name, content_category, value, currency, ... }
  window.metaTrack = function (eventName, customData, user) {
    customData = customData || {};
    user = user || {};
    var eventId = uuid();

    if (typeof window.fbq === 'function') {
      try {
        window.fbq('track', eventName, customData, { eventID: eventId });
      } catch (e) { console.warn('fbq error:', e); }
    }

    sendCapi({
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      action_source: 'website',
      custom_data: customData,
      user: user,
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc'),
    });

    return eventId;
  };

  // Fire PageView on load (browser pixel already fires its own; this only
  // sends the matching CAPI event with the same id so they dedupe).
  window.addEventListener('DOMContentLoaded', function () {
    var eventId = uuid();
    if (typeof window.fbq === 'function') {
      try { window.fbq('track', 'PageView', {}, { eventID: eventId }); }
      catch (e) { /* the inline init already fired one without id; that one will be deduped by browser-only fallback */ }
    }
    sendCapi({
      event_name: 'PageView',
      event_id: eventId,
      event_source_url: window.location.href,
      action_source: 'website',
      fbp: getCookie('_fbp'),
      fbc: getCookie('_fbc'),
    });
  });
})();
