// ==UserScript==
// @name         Lolzteam CleanBANLOGS
// @namespace    http://tampermonkey.net/
// @version      9.0
// @description  Адекватные ban логи на форуме, !!нахуй ксенфоро!!
// @author       lolz.live/gay1234
// @match        https://lolz.live/*
// @match        https://zelenka.guru/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
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

    (document.head || document.documentElement).appendChild(style);

    function processLogs() {
        const logTable = document.querySelector('table.userChangeLogs');
        if (!logTable || document.getElementById('clean-ban-logs-table')) return;

        const rows = logTable.querySelectorAll('tbody > tr');
        if (rows.length === 0) return;

        let events = [];
        let currentEvent = null;

        rows.forEach(row => {
            const header = row.querySelector('.logHeader');
            const field = row.querySelector('.logField');

            if (header) {
                if (currentEvent) events.push(currentEvent);

                const timeEl = header.querySelector('time.u-dt');
                const timeClone = timeEl ? timeEl.cloneNode(true) : document.createTextNode('Дата неизвестна');
                const timestamp = timeEl ? parseInt(timeEl.getAttribute('data-timestamp')) : 0;

                const links = header.querySelectorAll('a.username');
                let modHtml = '<span style="color: #f13838; font-weight: 600;">root</span> отредактировал(а)';
                if (links.length >= 2) {
                    modHtml = links[links.length - 1].outerHTML + ' отредактировал(а)';
                }

                currentEvent = {
                    timestamp: timestamp,
                    timeEl: timeClone,
                    moderatorHtml: modHtml,
                    status: 'Изменение статуса',
                    statusColor: '#aaa',
                    reasonHtml: 'Не указана'
                };
            } else if (field && currentEvent) {
                const fieldName = field.textContent.trim();
                const cells = row.querySelectorAll('td');
                const oldValTd = cells[1] ? cells[1].innerHTML : '';
                const newValTd = cells[2] ? cells[2].innerHTML : '';

                const getText = (html) => {
                    const temp = document.createElement('div');
                    temp.innerHTML = html;
                    return temp.textContent.trim();
                };

                if (fieldName === 'Заблокирован(а)') {
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

                if (fieldName === 'Причина блокировки') {
                    let reasonText = getText(newValTd);
                    let reasonHtml = newValTd;

                    if (!reasonText || reasonText === '.' || reasonText === '. Пожизненная блокировка.') {
                        reasonText = getText(oldValTd);
                        reasonHtml = oldValTd;
                    }
                    if (reasonHtml.startsWith('.')) {
                        reasonHtml = reasonHtml.replace(/^\.\s*/, '');
                    }
                    if (reasonText && reasonText !== '.') {
                        currentEvent.reasonHtml = reasonHtml;
                    }
                }
            }
        });

        if (currentEvent) events.push(currentEvent);

        events.sort((a, b) => b.timestamp - a.timestamp);

        const banCount = events.filter(e => e.status === 'Заблокирован').length;

        let buttonsDiv = logTable.parentNode.querySelector('#logs-buttons-f');
        if (!buttonsDiv) {
            buttonsDiv = document.createElement('div');
            buttonsDiv.id = 'logs-buttons-f';
            logTable.parentNode.insertBefore(buttonsDiv, logTable);
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

        logTable.parentNode.replaceChild(newTable, logTable);
    }
    const observer = new MutationObserver(() => {
        if (document.querySelector('table.userChangeLogs') && !document.getElementById('clean-ban-logs-table')) {
            processLogs();
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
