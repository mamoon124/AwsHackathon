/* PharmaStock UI helpers
   Purely presentational. It never touches your Firebase/app.js logic:
   - toggles password visibility on the login form
   - lets Enter submit the login form
   - fills the summary cards by reading the rows already rendered in the table
   Remove the <script src="ui.js"> tag and the app still works. */

(function () {
    // ---- Login form niceties -------------------------------------------
    const pw = document.getElementById('authPassword');
    const email = document.getElementById('authEmail');
    const toggle = document.getElementById('togglePassword');

    if (pw && toggle) {
        toggle.addEventListener('click', function () {
            const show = pw.type === 'password';
            pw.type = show ? 'text' : 'password';
            toggle.classList.toggle('is-on', show);
            toggle.setAttribute('aria-pressed', String(show));
            toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        });
    }

    [email, pw].forEach(function (el) {
        if (!el) return;
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && typeof window.handleLogin === 'function') {
                window.handleLogin();
            }
        });
    });

    // ---- Summary cards --------------------------------------------------
    const body = document.getElementById('inventoryBody');
    if (!body) return;

    const $ = function (id) { return document.getElementById(id); };
    const num = function (text) {
        const n = parseFloat(String(text).replace(/[^0-9.\-]/g, ''));
        return isNaN(n) ? 0 : n;
    };
    const plural = function (n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); };

    function update() {
        // Ignore the "Fetching..." / empty-state row (single colspan cell)
        const rows = Array.prototype.filter.call(body.querySelectorAll('tr'), function (r) {
            return r.cells.length >= 6;
        });

        let units = 0;
        let value = 0;
        let low = 0;
        let expiring = 0;
        let expired = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        rows.forEach(function (r) {
            const qty = num(r.cells[2].textContent);
            const price = num(r.cells[5].textContent);
            units += qty;
            value += qty * price;
            if (r.classList.contains('low-stock')) low++;

            const d = new Date(r.cells[3].textContent.trim());
            if (!isNaN(d.getTime())) {
                const days = Math.floor((d - today) / 86400000);
                if (days < 0) { expired++; expiring++; }
                else if (days <= 30) { expiring++; }
            }
        });

        const has = rows.length > 0;
        $('statItems').textContent = has ? rows.length : '–';
        $('statItemsNote').textContent = has ? units.toLocaleString('en-IN') + ' units on hand' : 'No items yet';

        $('statValue').textContent = has ? '₹' + Math.round(value).toLocaleString('en-IN') : '–';

        $('statLow').textContent = has ? low : '–';
        $('statLowNote').textContent = !has ? 'No items yet' : low ? plural(low, 'item') + ' to reorder' : 'Nothing to reorder';

        $('statExpiring').textContent = has ? expiring : '–';
        $('statExpiringNote').textContent = !has ? 'No items yet' : expired ? expired + ' already expired' : 'None expired';
    }

    new MutationObserver(update).observe(body, { childList: true, subtree: true, characterData: true });
    update();
})();