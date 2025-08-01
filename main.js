const TEXTS = {
    months: [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ],
    days: [
        "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
    ],
    loading: "Cargando cumpleaños...",
    no_birthdays: "No hay cumpleaños registrados para este mes.",
    error_loading: "Error al cargar los cumpleaños. Por favor, asegúrese de que el servidor API esté en funcionamiento y sea accesible desde su red.",
    office: "OFICINA",
    birthday: "🎂",
    celebration: (names) => `¡Hoy celebramos a ${names.join(", ")}! 🎉`
};
const API_BASE_URL = 'http://192.168.3.53:8002/sap/zhcm_master_dat';
const SAP_CLIENT = '201';
const PLACEHOLDER_PHOTO_URL = 'https://placehold.co/50x50/cccccc/ffffff?text=👤';
const CACHE_KEY_EMPLOYEES = 'allEmployeesDataCache';
const PHOTO_CACHE = {};

document.addEventListener('DOMContentLoaded', () => {
    const birthdayListDiv = document.getElementById('birthdayList');
    const currentMonthHeader = document.getElementById('currentMonth');
    const noBirthdaysMessage = document.getElementById('noBirthdaysMessage');
    const monthFilter = document.getElementById('monthFilter');
    const celebrationMsg = document.getElementById('celebrationMsg');

    TEXTS.months.forEach((month, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = month;
        monthFilter.appendChild(opt);
    });

    let allEmployeesData = [];
    let currentMonthIndex = new Date().getMonth();
    monthFilter.value = currentMonthIndex;

    loadBirthdays(currentMonthIndex);

    async function loadBirthdays(monthIndex) {
        celebrationMsg.style.display = "none";
        currentMonthHeader.textContent = `Mes de ${TEXTS.months[monthIndex]}`;
        birthdayListDiv.innerHTML = `<p class="text-gray-600 col-span-full">${TEXTS.loading}</p>`;
        noBirthdaysMessage.classList.add('hidden');

        let cachedData = sessionStorage.getItem(CACHE_KEY_EMPLOYEES);
        if (cachedData) {
            try {
                allEmployeesData = JSON.parse(cachedData);
                filterAndDisplayBirthdays(monthIndex);
                return;
            } catch {
                sessionStorage.removeItem(CACHE_KEY_EMPLOYEES);
            }
        }
        try {
            const response = await fetch(`${API_BASE_URL}?sap-client=${SAP_CLIENT}&allEmployees=X`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            allEmployeesData = data.MAIN && Array.isArray(data.MAIN) ? data.MAIN : [];
            sessionStorage.setItem(CACHE_KEY_EMPLOYEES, JSON.stringify(allEmployeesData));
            filterAndDisplayBirthdays(monthIndex);
        } catch (error) {
            birthdayListDiv.innerHTML = `<p class="text-red-500 col-span-full text-left">${TEXTS.error_loading}<br><small>(${error.message})</small></p>`;
            noBirthdaysMessage.classList.add('hidden');
        }
    }

    function filterAndDisplayBirthdays(monthIndex) {
        const today = new Date();
        let birthdaysThisMonth = [];
        let birthdayNamesToday = [];

        allEmployeesData.forEach(employee => {
            if (employee.STATUS === 'A' && employee.BIRTHDATE) {
                try {
                    const birthDateString = String(employee.BIRTHDATE);
                    const year = parseInt(birthDateString.substring(0, 4));
                    const month = parseInt(birthDateString.substring(4, 6)) - 1;
                    const day = parseInt(birthDateString.substring(6, 8));
                    if (month !== monthIndex) return;

                    const fullDate = new Date(today.getFullYear(), month, day);

                    let isToday = (monthIndex === today.getMonth() && day === today.getDate());
                    if (isToday) birthdayNamesToday.push(`${employee.FIRSTNAME || ''} ${employee.LASTNAME || ''}`.trim());

                    birthdaysThisMonth.push({
                        name: `${employee.FIRSTNAME || ''} ${employee.LASTNAME || ''}`.trim(),
                        office: employee.OFFICEID || 'N/A',
                        day,
                        employeeId: employee.EMPLOYEEID || null,
                        fullDate
                    });
                } catch (e) { }
            }
        });

        birthdaysThisMonth.sort((a, b) => a.day - b.day);

        let htmlParts = [];
        if (birthdaysThisMonth.length > 0) {
            birthdaysThisMonth.forEach(bday => {
                let cardClasses = 'birthday-item';
                const dayOfWeek = bday.fullDate.getDay();
                const bdayDateThisYear = new Date(today.getFullYear(), monthIndex, bday.day);
                const daysDiff = Math.ceil((bdayDateThisYear - getNormalizedDate(today)) / (1000 * 60 * 60 * 24));
                if (monthIndex === today.getMonth()) {
                    if (daysDiff === 0) cardClasses += ' today-birthday';
                    else if (daysDiff > 0 && daysDiff <= 7) cardClasses += ' upcoming-birthday';
                }
                htmlParts.push(`
                    <div class="${cardClasses}" tabindex="0" aria-label="Cumpleaños de ${bday.name}">
                        <div class="flex items-center mb-2" style="position:relative;">
                            <img src="${PLACEHOLDER_PHOTO_URL}" class="employee-photo" alt="Foto de ${bday.name}" 
                                role="img" aria-label="Foto de ${bday.name}" data-employee-id="${bday.employeeId || ''}" data-loading="true" data-error="false" data-photo-loaded="false" tabindex="0">
                            <span class="birthday-name">${bday.name}</span>
                        </div>
                        <div class="birthday-details">
                            <span class="birthday-office">${TEXTS.office}: <span style="color: #db0000;">${bday.office}</span></span>
                            <span class="birthday-day">${TEXTS.birthday} ${TEXTS.days[dayOfWeek]} ${bday.day}</span>
                        </div>
                    </div>
                `);
            });
            birthdayListDiv.innerHTML = htmlParts.join('');
            setupPhotoLazyLoad();
            if (birthdayNamesToday.length > 0 && monthIndex === today.getMonth()) {
                celebrationMsg.textContent = TEXTS.celebration(birthdayNamesToday);
                celebrationMsg.style.display = "";
                triggerConfetti();
            } else {
                celebrationMsg.style.display = "none";
            }
        } else {
            birthdayListDiv.innerHTML = '';
            noBirthdaysMessage.classList.remove('hidden');
            celebrationMsg.style.display = "none";
        }
    }

    function setupPhotoLazyLoad() {
        const photoEls = birthdayListDiv.querySelectorAll('.employee-photo');
        photoEls.forEach(img => {
            img.setAttribute('role', 'img');
            img.setAttribute('aria-label', img.alt);
            addSpinner(img);
        });

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.loading === "true" && img.dataset.employeeId) {
                            loadEmployeePhoto(img, img.dataset.employeeId);
                        }
                        obs.unobserve(img);
                    }
                });
            }, { root: birthdayListDiv, threshold: 0.2 });
            photoEls.forEach(img => observer.observe(img));
        } else {
            photoEls.forEach(img => {
                if (img.dataset.loading === "true" && img.dataset.employeeId) {
                    loadEmployeePhoto(img, img.dataset.employeeId);
                }
            });
        }
    }

    function addSpinner(img) {
        let s = img.parentElement.querySelector('.photo-spinner');
        if (s) s.remove();
        const spinnerDiv = document.createElement('div');
        spinnerDiv.className = "photo-spinner";
        spinnerDiv.innerHTML = `<svg class="animate-spin" viewBox="0 0 50 50">
            <circle class="opacity-30" cx="25" cy="25" r="20" stroke="currentColor" stroke-width="5" fill="none"/>
            <path class="opacity-80" fill="currentColor" d="M25 5a20 20 0 1 1-7.1 1.3"/>
        </svg>`;
        img.parentElement.appendChild(spinnerDiv);
    }
    function removeSpinner(img) {
        let s = img.parentElement.querySelector('.photo-spinner');
        if (s) s.remove();
    }
    function addErrorIcon(img) {
        let e = img.parentElement.querySelector('.photo-error-icon');
        if (e) e.remove();
        const errorDiv = document.createElement('div');
        errorDiv.className = "photo-error-icon";
        errorDiv.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff"/><path fill="#e00" d="M13 17h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
        img.parentElement.appendChild(errorDiv);
    }
    function removeErrorIcon(img) {
        let e = img.parentElement.querySelector('.photo-error-icon');
        if (e) e.remove();
    }

    async function loadEmployeePhoto(imgElement, employeeId) {
        if (!employeeId) {
            imgElement.src = PLACEHOLDER_PHOTO_URL;
            imgElement.dataset.loading = "false";
            imgElement.dataset.photoLoaded = "false";
            return;
        }
        if (PHOTO_CACHE[employeeId]) {
            imgElement.src = PHOTO_CACHE[employeeId];
            imgElement.dataset.loading = "false";
            removeSpinner(imgElement);
            removeErrorIcon(imgElement);
            imgElement.dataset.error = "false";
            imgElement.dataset.photoLoaded = "true";
            return;
        }
        imgElement.dataset.loading = "true";
        imgElement.dataset.error = "false";
        imgElement.dataset.photoLoaded = "false";
        removeErrorIcon(imgElement);
        addSpinner(imgElement);
        try {
            const apiUrl = `${API_BASE_URL}?sap-client=${SAP_CLIENT}&EmployeeID=${employeeId}&Photo=X`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const data = await response.json();
            if (data.MAIN && data.MAIN.length > 0 && data.MAIN[0].IMAGE) {
                const photoBase64 = data.MAIN[0].IMAGE;
                if (photoBase64.length > 100) {
                    const src = `data:image/jpeg;base64,${photoBase64}`;
                    imgElement.src = src;
                    imgElement.dataset.loading = "false";
                    removeSpinner(imgElement);
                    removeErrorIcon(imgElement);
                    imgElement.dataset.error = "false";
                    imgElement.dataset.photoLoaded = "true";
                    PHOTO_CACHE[employeeId] = src;
                } else {
                    throw new Error("Base64 corto/vacío");
                }
            } else {
                throw new Error("No hay campo IMAGE");
            }
        } catch (error) {
            imgElement.src = PLACEHOLDER_PHOTO_URL;
            imgElement.dataset.loading = "false";
            imgElement.dataset.error = "true";
            imgElement.dataset.photoLoaded = "false";
            addErrorIcon(imgElement);
            removeSpinner(imgElement);
        }
    }

    function triggerConfetti() {
        if (window.confetti) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }

    function getNormalizedDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    monthFilter.addEventListener('change', (event) => {
        currentMonthIndex = parseInt(event.target.value);
        filterAndDisplayBirthdays(currentMonthIndex);
    });
});