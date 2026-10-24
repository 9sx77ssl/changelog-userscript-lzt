// ==UserScript==
// @name         Lolzteam CleanBANLOGS
// @namespace    http://tampermonkey.net/
// @version      9.1
// @description  Адекватные ban логи на форуме, !!нахуй ксенфоро!!
// @author       lolz.team/gay1234
// @match        https://lolz.team/*
// @match        https://lolz.live/*
// @match        https://lolz.guru/*
// @match        https://zelenka.guru/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STYLE_ID = 'clean-ban-logs-style';

    const styleText = `
        #clean-ban-logs-table .ban-block-group .ban-cell {
            padding: 12px 20px !important;
        }
        #clean-ban-logs-table .ban-block-group .ban-row-header .ban-cell {
            border-top: 1px solid #3a3a3a !important;
        }
        #clean-ban-logs-table .ban-block-group .ban-row-mid .ban-cell {
            border-top: none !important;
            border-bottom: 1px solid #2a2a2a !important;
        }
        #clean-ban-logs-table .ban-spacer {
            height: 10px;
            background: transparent !important;
            border: none !important;
        }
        #clean-ban-logs-table .ban-spacer td {
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
        }
    `;

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const host = document.head || document.documentElement;
        if (!host) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = styleText;
        host.appendChild(style);
    }

    function getText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent.trim();
    }

    function cleanReasonHtml(html) {
        const temp = document.createElement('template');
        temp.innerHTML = html;

        const walker = document.createTreeWalker(temp.content, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && !node.nodeValue.trim()) node = walker.nextNode();
        if (node) node.nodeValue = node.nodeValue.replace(/^\s*\.\s*/, '');

        return temp.innerHTML;
    }

    function processLogs() {
        const logTable = Array.from(document.querySelectorAll('table.userChangeLogs'))
            .find(table => table.id !== 'clean-ban-logs-table');
        if (!logTable) return;

        const wrapper = logTable.parentNode;
        if (!wrapper || wrapper.querySelector('#clean-ban-logs-table')) return;

        const rows = logTable.querySelectorAll('tbody > tr');
        if (rows.length === 0 || !logTable.querySelector('.logHeader')) return;

        let events = [];
        let currentEvent = null;

        rows.forEach(row => {
            const header = row.querySelector('.logHeader');
            const field = row.querySelector('.logField');

            if (header) {
                if (currentEvent) events.push(currentEvent);

                const timeEl = header.querySelector('time.u-dt');
                const timeClone = timeEl ? timeEl.cloneNode(true) : document.createTextNode('Дата неизвестна');
                const timestamp = timeEl ? parseInt(timeEl.getAttribute('data-timestamp'), 10) || 0 : 0;

                const links = header.querySelectorAll('a.username');
                let moderatorHtml = '<span class="muted">Неизвестно</span>';
                if (links.length) {
                    moderatorHtml = links[links.length - 1].outerHTML;
                    if (/отредактировал|edited/i.test(header.textContent)) {
                        moderatorHtml += ' отредактировал(а)';
                    }
                }

                currentEvent = {
                    timestamp: timestamp,
                    timeEl: timeClone,
                    moderatorHtml: moderatorHtml,
                    status: 'Изменение статуса',
                    statusColor: '#aaa',
                    reasonHtml: 'Не указана'
                };
            } else if (field && currentEvent) {
                const fieldName = field.textContent.trim();
                const cells = row.cells;
                const oldValTd = cells[1] ? cells[1].innerHTML : '';
                const newValTd = cells[2] ? cells[2].innerHTML : '';

                if (fieldName === 'Заблокирован' || fieldName === 'Заблокирован(а)' || fieldName === 'Banned') {
                    const oldText = getText(oldValTd);
                    const newText = getText(newValTd);
                    if (newText === 'Да' && oldText === 'Нет') {
                        currentEvent.status = 'Заблокирован';
                        currentEvent.statusColor = '#f13838';
                    } else if (newText === 'Нет' && oldText === 'Да') {
                        currentEvent.status = 'Разблокирован';
                        currentEvent.statusColor = 'rgb(0, 186, 120)';
                    }
                }

                if (fieldName === 'Причина блокировки' || fieldName === 'Ban reason') {
                    let reasonText = getText(newValTd);
                    let reasonHtml = newValTd;

                    if (!reasonText || reasonText === '.' || reasonText === '. Пожизненная блокировка.') {
                        const oldText = getText(oldValTd);
                        if (oldText && oldText !== '.') {
                            reasonText = oldText;
                            reasonHtml = oldValTd;
                        }
                    }
                    if (reasonText && reasonText !== '.') {
                        currentEvent.reasonHtml = cleanReasonHtml(reasonHtml);
                    }
                }
            }
        });

        if (currentEvent) events.push(currentEvent);

        events.sort((a, b) => b.timestamp - a.timestamp);

        const banCount = events.filter(e => e.status === 'Заблокирован').length;

        let buttonsDiv = wrapper.querySelector('#logs-buttons-f');
        if (!buttonsDiv) {
            buttonsDiv = document.createElement('div');
            buttonsDiv.id = 'logs-buttons-f';
            wrapper.insertBefore(buttonsDiv, logTable);
        }
        buttonsDiv.innerHTML = `<span>Всего банов: ${banCount} <img src="https://nztcdn.com/files/f6261e1b-8534-4a4d-97d1-2cc0ea5d402a.webp" alt="rooster" style="width:25px; height:16px; vertical-align: middle;"></span>`;

        const newTable = document.createElement('table');
        newTable.id = 'clean-ban-logs-table';
        newTable.className = 'dataTable userChangeLogs';
        newTable.style.tableLayout = 'fixed';

        events.forEach((ev, index) => {
            const blockBody = document.createElement('tbody');
            blockBody.className = 'ban-block-group';

            const trHeader = document.createElement('tr');
            trHeader.className = 'dataRow secondaryContent ban-row-header';

            const tdHeader = document.createElement('td');
            tdHeader.colSpan = 3;
            tdHeader.className = 'logHeader ban-cell';

            const label = document.createElement('label');
            label.className = 'muted fl_r';
            label.appendChild(ev.timeEl);

            tdHeader.appendChild(label);
            tdHeader.insertAdjacentHTML('beforeend', ` ${ev.moderatorHtml}`);

            trHeader.appendChild(tdHeader);
            blockBody.appendChild(trHeader);

            const trStatus = document.createElement('tr');
            trStatus.className = 'dataRow ban-row-mid';
            trStatus.innerHTML = `
                <td class="logField ban-cell">Статус</td>
                <td colspan="2" class="ban-cell"><span style="color: ${ev.statusColor}; font-weight: 600;">${ev.status}</span></td>
            `;
            blockBody.appendChild(trStatus);

            const trReason = document.createElement('tr');
            trReason.className = 'dataRow ban-row-footer';
            trReason.innerHTML = `
                <td class="logField ban-cell">Причина</td>
                <td colspan="2" class="ban-cell">${ev.reasonHtml}</td>
            `;
            blockBody.appendChild(trReason);

            newTable.appendChild(blockBody);

            if (index < events.length - 1) {
                const spacerBody = document.createElement('tbody');
                spacerBody.className = 'ban-spacer';
                spacerBody.innerHTML = `<tr><td colspan="3"></td></tr>`;
                newTable.appendChild(spacerBody);
            }
        });

        wrapper.replaceChild(newTable, logTable);
    }

    let scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        window.setTimeout(() => {
            scheduled = false;
            processLogs();
        }, 50);
    }

    let started = false;
    function start() {
        if (started) return;
        if (!document.documentElement || !document.head) {
            window.setTimeout(start, 16);
            return;
        }

        started = true;
        injectStyle();
        processLogs();

        const observer = new MutationObserver(schedule);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        window.addEventListener('hashchange', schedule, true);
        window.addEventListener('popstate', schedule, true);
    }

    start();
})();
