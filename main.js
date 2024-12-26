// משתנים גלובליים
window.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
window.currentView = localStorage.getItem('currentView') || 'monthly'; // ברירת מחדל - תצוגה חודשית
window.currentChart = null;

// משתנה גלובלי לשמירת ההוצאות שנבחרו
window.selectedExpenses = new Set();

// פונקציה למעבר בין תצוגות
window.switchView = function(view) {
    // שמירת התצוגה הנוכחית
    window.currentView = view;
    localStorage.setItem('currentView', view);

    // עדכון כפתורי התצוגה
    document.querySelectorAll('.btn-group .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`#${view}ViewBtn`).classList.add('active');

    // הצגת הקונטיינר המתאים
    if (view === 'yearly') {
        document.getElementById('expensesContainer').style.display = 'none';
        document.getElementById('yearlySummaryContainer').style.display = 'block';
        window.updateYearlySummary();
    } else {
        document.getElementById('expensesContainer').style.display = 'block';
        document.getElementById('yearlySummaryContainer').style.display = 'none';
        window.updateTable();
    }

    // עדכון הגרף
    window.updateCharts();
};

// פונקציה לטעינת הדף
window.onload = function() {
    // טעינת הוצאות מ-localStorage
    window.expenses = JSON.parse(localStorage.getItem('expenses')) || [];

    // הוספת ID להוצאות קיימות שאין להן
    window.expenses.forEach(expense => {
        if (!expense.id) {
            expense.id = generateUniqueId();
        }
    });
    localStorage.setItem('expenses', JSON.stringify(window.expenses));

    // טעינת התצוגה הנוכחית
    const currentView = localStorage.getItem('currentView') || 'monthly';
    window.switchView(currentView);
};

// פונקציה למיון הטבלה
window.sortTable = function(header, column) {
    const table = header.closest('table');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const isAscending = header.classList.toggle('asc');

    const compareValues = (a, b) => {
        if (typeof a === 'number' && typeof b === 'number') {
            return isAscending ? a - b : b - a;
        }
        // המרה למחרוזת לפני ההשוואה
        return isAscending ? 
            String(a).localeCompare(String(b), 'he') : 
            String(b).localeCompare(String(a), 'he');
    };

    const sortedRows = rows.sort((rowA, rowB) => {
        const cellA = rowA.querySelector(`td:nth-child(${getColumnIndex(column) + 1})`);
        const cellB = rowB.querySelector(`td:nth-child(${getColumnIndex(column) + 1})`);
        
        if (!cellA || !cellB) return 0;

        let aVal = cellA.textContent.trim();
        let bVal = cellB.textContent.trim();

        // טיפול במקרים מיוחדים
        if (column === 'amount') {
            // הסרת סימן המטבע וקבלת מספר
            aVal = parseFloat(aVal.replace(/[^\d.-]/g, ''));
            bVal = parseFloat(bVal.replace(/[^\d.-]/g, ''));
        } else if (column === 'date') {
            // המרת תאריך למספר לצורך השוואה
            const [dayA, monthA, yearA] = aVal.split('/').map(Number);
            const [dayB, monthB, yearB] = bVal.split('/').map(Number);
            aVal = new Date(yearA, monthA - 1, dayA).getTime();
            bVal = new Date(yearB, monthB - 1, dayB).getTime();
        } else if (column === 'percentage') {
            // הסרת סימן האחוז וקבלת מספר
            aVal = parseFloat(aVal.replace('%', '')) || 0;
            bVal = parseFloat(bVal.replace('%', '')) || 0;
        }

        return compareValues(aVal, bVal);
    });

    tbody.innerHTML = '';
    sortedRows.forEach(row => tbody.appendChild(row));
};

// פונקציה להשגת אינדקס העמודה
function getColumnIndex(columnName) {
    const columnMap = {
        'date': 0,
        'description': 1,
        'category': 2,
        'amount': 3,
        'percentage': 4,
        'actualAmount': 5,
        'comment': 6
    };
    return columnMap[columnName] || 0;
}

// פונקציה לעדכון טבלת הוצאות
window.updateTable = function() {
    const container = document.querySelector('#expensesContainer');
    if (!container || !window.expenses) return;

    // איפוס ההוצאות שנבחרו
    window.selectedExpenses.clear();

    // ארגון הנתונים לפי חודשים
    const monthlyData = {};
    window.expenses.forEach(expense => {
        const [day, month, year] = expense.date.split('/');
        const monthKey = `${month}/${year}`;
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                expenses: [],
                total: 0,
                actualTotal: 0
            };
        }
        monthlyData[monthKey].expenses.push(expense);
        monthlyData[monthKey].total += parseFloat(expense.amount);
        monthlyData[monthKey].actualTotal += parseFloat(expense.amount) * (parseFloat(expense.percentage) || 100) / 100;
    });

    // ניקוי הקונטיינר
    container.innerHTML = '';

    // כפתור מחיקת הוצאות נבחרות
    const deleteButtonsContainer = document.createElement('div');
    deleteButtonsContainer.className = 'px-3 py-2 border-bottom';
    deleteButtonsContainer.innerHTML = `
        <button id="deleteSelectedBtn" class="btn btn-danger me-2 d-none">
            <i class="bi bi-trash"></i> מחק הוצאות נבחרות
        </button>
        <button id="deleteAllBtn" class="btn btn-outline-danger" onclick="window.deleteAllExpenses()">
            <i class="bi bi-trash"></i> מחק את כל ההוצאות
        </button>
    `;
    container.appendChild(deleteButtonsContainer);

    // מיון החודשים בסדר יורד
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
        const [monthA, yearA] = a.split('/').map(Number);
        const [monthB, yearB] = b.split('/').map(Number);
        if (yearA !== yearB) return yearB - yearA;
        return monthB - monthA;
    });

    // יצירת טבלה לכל חודש
    sortedMonths.forEach(monthKey => {
        const [month, year] = monthKey.split('/');
        const monthData = monthlyData[monthKey];

        const monthCard = document.createElement('div');
        monthCard.className = 'card mb-4';
        monthCard.setAttribute('data-month', monthKey);
        monthCard.innerHTML = `
            <div class="card-header d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="form-check me-2">
                        <input type="checkbox" class="form-check-input" 
                            onchange="window.toggleMonthSelection('${monthKey}', this.checked)">
                    </div>
                    <h5 class="mb-0">${getHebrewMonth(parseInt(month))} ${year}</h5>
                </div>
                <div>
                    <span class="badge bg-primary me-2">סה"כ: ${formatCurrency(monthData.total)}</span>
                    <span class="badge bg-success">בפועל: ${formatCurrency(monthData.actualTotal)}</span>
                </div>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-striped table-hover mb-0">
                        <thead>
                            <tr>
                                <th style="width: 40px;"></th>
                                <th onclick="window.sortTable(this, 'date')">תאריך</th>
                                <th onclick="window.sortTable(this, 'description')">תיאור</th>
                                <th onclick="window.sortTable(this, 'category')">קטגוריה</th>
                                <th onclick="window.sortTable(this, 'amount')" class="text-end">סכום</th>
                                <th onclick="window.sortTable(this, 'percentage')" class="text-end">אחוז</th>
                                <th onclick="window.sortTable(this, 'actualAmount')" class="text-end">סכום בפועל</th>
                                <th onclick="window.sortTable(this, 'comment')">פירוט הוצאה</th>
                                <th>פעולות</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthData.expenses
                                .sort((a, b) => {
                                    const [dayA] = a.date.split('/').map(Number);
                                    const [dayB] = b.date.split('/').map(Number);
                                    return parseInt(dayB) - parseInt(dayA);
                                })
                                .map(expense => {
                                    const actualAmount = expense.amount * (expense.percentage || 100) / 100;
                                    return `
                                        <tr>
                                            <td>
                                                <div class="form-check">
                                                    <input type="checkbox" class="form-check-input" 
                                                        id="checkbox-${expense.id}"
                                                        data-expense-id="${expense.id}"
                                                        onchange="window.toggleExpenseSelection('${expense.id}')">
                                                </div>
                                            </td>
                                            <td>${expense.date}</td>
                                            <td class="description-cell" onclick="window.editDescription(this, '${expense.id}')">${expense.description}</td>
                                            <td class="category-cell" onclick="window.editCategory(this, '${expense.id}')">${expense.category || ''}</td>
                                            <td class="text-end amount-cell" onclick="window.editAmount(this, '${expense.id}')">${formatCurrency(expense.amount)}</td>
                                            <td class="text-end percentage-cell" onclick="window.editPercentage(this, '${expense.id}')">${expense.percentage || 100}%</td>
                                            <td class="text-end">${formatCurrency(actualAmount)}</td>
                                            <td class="comment-cell" onclick="window.editComment(this, '${expense.id}')">${expense.comment || ''}</td>
                                            <td>
                                                <div class="btn-group">
                                                    <button class="btn btn-sm btn-info" onclick="window.editExpense('${expense.id}')">
                                                        <i class="bi bi-pencil"></i>
                                                    </button>
                                                    <button class="btn btn-sm btn-danger" onclick="window.deleteExpense('${expense.id}')">
                                                        <i class="bi bi-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.appendChild(monthCard);
    });

    // אם אין הוצאות, מציג הודעה
    if (sortedMonths.length === 0) {
        container.innerHTML = '<div class="alert alert-info m-3">אין הוצאות להצגה</div>';
    }

    // הוספת מאזין לכפתור מחיקה
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    if (deleteBtn) {
        deleteBtn.onclick = window.deleteSelectedExpenses;
    }
};

// פונקציה לבחירת/ביטול בחירת הוצאה
window.toggleExpenseSelection = function(id) {
    const checkbox = document.querySelector(`#checkbox-${id}`);
    if (checkbox.checked) {
        window.selectedExpenses.add(id);
    } else {
        window.selectedExpenses.delete(id);
    }
    updateDeleteButtonState();
};

// פונקציה לבחירת/ביטול בחירת כל ההוצאות בחודש
window.toggleMonthSelection = function(monthKey, checked) {
    const monthCheckboxes = document.querySelectorAll(`[data-month="${monthKey}"] input[type="checkbox"]`);
    monthCheckboxes.forEach(checkbox => {
        checkbox.checked = checked;
        const id = checkbox.getAttribute('data-expense-id');
        if (checked) {
            window.selectedExpenses.add(id);
        } else {
            window.selectedExpenses.delete(id);
        }
    });
    updateDeleteButtonState();
};

// פונקציה לעדכון מצב כפתור המחיקה
function updateDeleteButtonState() {
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    if (window.selectedExpenses.size > 0) {
        deleteBtn.classList.remove('d-none');
        deleteBtn.textContent = `מחק ${window.selectedExpenses.size} הוצאות נבחרות`;
    } else {
        deleteBtn.classList.add('d-none');
    }
}

// פונקציה למחיקת הוצאות נבחרות
window.deleteSelectedExpenses = function() {
    if (window.selectedExpenses.size === 0) return;

    if (confirm(`האם אתה בטוח שברצונך למחוק ${window.selectedExpenses.size} הוצאות?`)) {
        window.expenses = window.expenses.filter(expense => !window.selectedExpenses.has(expense.id));
        localStorage.setItem('expenses', JSON.stringify(window.expenses));
        window.selectedExpenses.clear();
        window.updateTable();
        window.updateCharts();
    }
};

// פונקציה למחיקת כל ההוצאות
window.deleteAllExpenses = function() {
    if (confirm('האם אתה בטוח שברצונך למחוק את כל ההוצאות? פעולה זו לא ניתנת לביטול!')) {
        window.expenses = [];
        localStorage.setItem('expenses', JSON.stringify(window.expenses));
        window.selectedExpenses.clear();
        window.updateTable();
        window.updateCharts();
    }
};

// פונקציה לעריכת אחוזים
window.editPercentage = function(cell, expenseId) {
    const expense = window.expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const currentPercentage = expense.percentage || 100;
    const newPercentage = prompt('הכנס אחוז חדש:', currentPercentage);
    
    if (newPercentage !== null) {
        const parsedPercentage = parseFloat(newPercentage);
        if (!isNaN(parsedPercentage)) {
            expense.percentage = parsedPercentage;
            localStorage.setItem('expenses', JSON.stringify(window.expenses));
            window.updateTable();
            window.updateCharts();
        }
    }
};

// פונקציה לעדכון קטגוריה לכל ההוצאות עם אותו תיאור
window.updateCategoryForDescription = function(description, newCategory) {
    let count = 0;
    window.expenses = window.expenses.map(expense => {
        if (expense.description === description) {
            count++;
            return { ...expense, category: newCategory };
        }
        return expense;
    });

    // שמירה ב-localStorage
    localStorage.setItem('expenses', JSON.stringify(window.expenses));
    
    // עדכון הטבלה והגרף
    window.updateTable();
    window.updateCharts();
    
    return count;
};

// פונקציה לעריכת קטגוריה
window.editCategory = function(cell, expenseId) {
    const currentCategory = cell.textContent;
    const expense = window.expenses.find(e => e.id === expenseId);
    
    if (!expense) return;

    const newCategory = prompt('הכנס קטגוריה חדשה:', currentCategory);
    if (newCategory === null) return; // המשתמש לחץ על ביטול

    // שאל את המשתמש אם לעדכן את כל ההוצאות עם אותו תיאור
    if (confirm(`האם לעדכן את הקטגוריה "${newCategory}" לכל ההוצאות עם התיאור "${expense.description}"?`)) {
        const updatedCount = window.updateCategoryForDescription(expense.description, newCategory);
        alert(`הקטגוריה עודכנה ב-${updatedCount} הוצאות`);
    } else {
        // עדכון רק להוצאה הנוכחית
        expense.category = newCategory;
        localStorage.setItem('expenses', JSON.stringify(window.expenses));
        window.updateTable();
        window.updateCharts();
    }
};

// פונקציה לעריכת הוצאה
window.editExpense = function(expenseId) {
    const expense = window.expenses.find(e => e.id === expenseId);
    if (!expense) return;

    // עדכון שדות המודל
    document.getElementById('editDate').value = expense.date;
    document.getElementById('editAmount').value = expense.amount;
    document.getElementById('editCategory').value = expense.category || '';
    document.getElementById('editDescription').value = expense.description || '';

    // שמירת ה-ID של ההוצאה הנוכחית
    window.currentEditExpenseId = expenseId;

    // פתיחת המודל
    const editModal = new bootstrap.Modal(document.getElementById('editExpenseModal'));
    editModal.show();
};

// פונקציה למחיקת הוצאה
window.deleteExpense = function(expenseId) {
    if (confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) {
        window.expenses = window.expenses.filter(expense => expense.id !== expenseId);
        localStorage.setItem('expenses', JSON.stringify(window.expenses));
        window.updateTable();
        window.updateCharts();
    }
};

// פונקציה לשמירת הוצאה שנערכה
window.saveEditedExpense = function() {
    const expense = window.expenses.find(e => e.id === window.currentEditExpenseId);
    if (!expense) return;

    expense.date = document.getElementById('editDate').value;
    expense.amount = parseFloat(document.getElementById('editAmount').value);
    expense.category = document.getElementById('editCategory').value;
    expense.description = document.getElementById('editDescription').value;

    localStorage.setItem('expenses', JSON.stringify(window.expenses));
    window.updateTable();
    window.updateCharts();

    // סגירת המודל
    const editModal = bootstrap.Modal.getInstance(document.getElementById('editExpenseModal'));
    editModal.hide();
};

// פונקציה למחיקת קטגוריה
window.deleteCategory = function(category) {
    if (confirm(`האם אתה בטוח שברצונך למחוק את כל ההוצאות בקטגוריה "${category}"?`)) {
        // מחיקת כל ההוצאות בקטגוריה
        window.expenses = window.expenses.filter(expense => expense.category !== category);
        
        // שמירה ב-localStorage
        localStorage.setItem('expenses', JSON.stringify(window.expenses));
        
        // עדכון התצוגה
        if (window.currentView === 'monthly') {
            window.updateTable();
        } else {
            window.updateYearlySummary();
        }
        window.updateCharts();
    }
};

// פונקציה לעריכת קטגוריה בטבלה השנתית
window.editYearlyCategory = function(cell, oldCategory) {
    const currentText = cell.textContent;
    
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'form-control form-control-sm';
    input.setAttribute('list', 'categories-list');
    input.style.width = '100%';
    
    // יצירת datalist להשלמה אוטומטית
    const datalist = document.createElement('datalist');
    datalist.id = 'categories-list';
    const uniqueCategories = window.getUniqueCategories();
    uniqueCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        datalist.appendChild(option);
    });
    
    // החלפת התא עם שדה הקלט
    cell.textContent = '';
    wrapper.appendChild(input);
    wrapper.appendChild(datalist);
    cell.appendChild(wrapper);
    input.focus();
    
    const updateCategory = (newCategory) => {
        if (newCategory && newCategory !== currentText) {
            // עדכון כל ההוצאות בקטגוריה
            window.expenses.forEach(expense => {
                if (expense.category === oldCategory) {
                    expense.category = newCategory;
                }
            });
            
            // שמירה ב-localStorage
            localStorage.setItem('expenses', JSON.stringify(window.expenses));
            
            // עדכון התצוגה
            window.updateYearlySummary();
            window.updateCharts();
            return true;
        }
        return false;
    };
    
    // טיפול באירוע איבוד פוקוס
    input.onblur = function() {
        const newCategory = input.value.trim();
        if (!updateCategory(newCategory)) {
            cell.textContent = currentText;
        }
    };
    
    // טיפול בלחיצה על Enter
    input.onkeydown = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newCategory = input.value.trim();
            if (updateCategory(newCategory)) {
                input.blur();
            }
        } else if (e.key === 'Escape') {
            cell.textContent = currentText;
        }
    };
};

// פונקציה לעריכת אחוז בטבלה השנתית
window.editYearlyPercentage = function(cell, category) {
    const currentText = cell.textContent.replace('%', '');
    
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.value = currentText;
    input.className = 'form-control form-control-sm';
    input.style.width = '60px';
    
    const updatePercentage = (newPercentage) => {
        if (newPercentage && !isNaN(newPercentage)) {
            // עדכון האחוז לכל ההוצאות בקטגוריה
            window.expenses.forEach(expense => {
                if (expense.category === category) {
                    expense.percentage = parseFloat(newPercentage);
                }
            });
            
            // שמירה ב-localStorage
            localStorage.setItem('expenses', JSON.stringify(window.expenses));
            
            // עדכון התצוגה
            window.updateYearlySummary();
            window.updateCharts();
            return true;
        }
        return false;
    };
    
    // החלפת התא עם שדה הקלט
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();
    input.select();
    
    // טיפול באירוע איבוד פוקוס
    input.onblur = function() {
        const newPercentage = input.value.trim();
        if (!updatePercentage(newPercentage)) {
            cell.textContent = currentText + '%';
        }
    };
    
    // טיפול בלחיצה על Enter
    input.onkeydown = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newPercentage = input.value.trim();
            if (updatePercentage(newPercentage)) {
                input.blur();
            }
        } else if (e.key === 'Escape') {
            cell.textContent = currentText + '%';
        }
    };
};

// פונקציה להשגת כל הקטגוריות הייחודיות
window.getUniqueCategories = function() {
    return [...new Set(window.expenses.map(expense => expense.category).filter(Boolean))];
};

// פונקציה להצגת פרטי קטגוריה
window.showCategoryDetails = function(year, category) {
    const expenses = window.expenses.filter(expense => {
        const expenseYear = expense.date.split('/')[2];
        return expenseYear === year && expense.category === category;
    });

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">פירוט הוצאות - ${category} (${year})</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>תאריך</th>
                                <th>תיאור</th>
                                <th>סכום</th>
                                <th>אחוז</th>
                                <th>סכום בפועל</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${expenses.map(expense => `
                                <tr>
                                    <td>${expense.date}</td>
                                    <td>${expense.description || ''}</td>
                                    <td class="text-end">${formatCurrency(expense.amount)}</td>
                                    <td>${expense.percentage || 100}%</td>
                                    <td class="text-end">${formatCurrency(expense.amount * (expense.percentage || 100) / 100)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    new bootstrap.Modal(modal).show();
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
};

// קטגוריות שמאפשרות הזנת אחוז
const PERCENTAGE_CATEGORIES = ['ארנונה', 'חשמל', 'מים'];

// פונקציה לעדכון סוג הגרף
window.updateChartType = function() {
    const chartType = document.getElementById('chartTypeSelect').value;
    updateCharts(chartType);
};

// פונקציה לעדכון הגרפים
window.updateCharts = function() {
    const ctx = document.getElementById('expenseChart');
    if (!ctx || !window.expenses || !window.expenses.length) return;

    // מחיקת גרף קיים אם יש
    if (window.currentChart) {
        window.currentChart.destroy();
    }

    // ארגון הנתונים לפי חודשים
    const monthlyData = {};
    window.expenses.forEach(expense => {
        const [day, month, year] = expense.date.split('/');
        const monthKey = `${month}/${year}`;
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                total: 0,
                actualTotal: 0
            };
        }
        monthlyData[monthKey].total += expense.amount;
        monthlyData[monthKey].actualTotal += expense.amount * (expense.percentage || 100) / 100;
    });

    // מיון החודשים
    const sortedMonths = Object.keys(monthlyData)
        .sort((a, b) => {
            const [monthA, yearA] = a.split('/').map(Number);
            const [monthB, yearB] = b.split('/').map(Number);
            if (yearA !== yearB) return yearA - yearB;
            return monthA - monthB;
        })
        .slice(-12); // 12 חודשים אחרונים

    const labels = sortedMonths.map(month => {
        const [m, y] = month.split('/');
        return `${getHebrewMonth(parseInt(m))} ${y}`;
    });

    // יצירת הגרף
    window.currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'סכום מקורי',
                    data: sortedMonths.map(month => monthlyData[month].total),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    order: 2
                },
                {
                    label: 'סכום בפועל',
                    data: sortedMonths.map(month => monthlyData[month].actualTotal),
                    type: 'line',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                    fill: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: 'הוצאות חודשיות'
                },
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatCurrency(context.raw);
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
};

// פונקציה לפיצול שורת CSV עם התחשבות במרכאות
window.parseCSVLine = function(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

// פונקציה לזיהוי הוצאה כפולה
window.isDuplicateExpense = function(expense, expenses) {
    return expenses.some(e => 
        e.date === expense.date && 
        e.amount === expense.amount && 
        e.description === expense.description &&
        e.category === expense.category
    );
}

// פונקציה לנרמול תאריך
window.normalizeDate = function(dateStr) {
    // הסרת מרכאות
    dateStr = dateStr.replace(/"/g, '');
    
    // פיצול התאריך לפי / או - או .
    let parts = dateStr.split(/[/\-\.]/);
    
    // אם התאריך בפורמט DD/MM/YYYY
    if (parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
    // אם התאריך בפורמט YYYY/MM/DD
    else if (parts[0].length === 4) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    
    return dateStr; // אם הפורמט לא מזוהה, להחזיר כמו שהוא
}

// פונקציה לעיבוד נתונים מ-CSV
window.processData = function() {
    const input = document.getElementById('expenseInput').value;
    if (!input.trim()) {
        alert('אנא הכנס נתונים');
        return;
    }

    const lines = input.trim().split('\n');
    let addedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    lines.forEach(line => {
        if (!line.trim()) return;

        const fields = window.parseCSVLine(line);
        if (fields.length >= 3) {
            const [dateStr, description, amount, category, comment] = fields;
            const normalizedDate = window.normalizeDate(dateStr);
            const cleanAmount = amount.replace(/[₪,"]/g, '').trim();
            const parsedAmount = parseFloat(cleanAmount);
            
            if (normalizedDate && !isNaN(parsedAmount)) {
                const newExpense = {
                    id: window.generateUniqueId(),
                    date: normalizedDate,
                    amount: parsedAmount,
                    category: category ? category.replace(/"/g, '') : '',
                    description: description ? description.replace(/"/g, '') : '',
                    comment: comment ? comment.replace(/"/g, '') : '',
                    percentage: 100
                };
                
                if (!window.isDuplicateExpense(newExpense, window.expenses)) {
                    window.expenses.push(newExpense);
                    addedCount++;
                } else {
                    duplicateCount++;
                }
            } else {
                errorCount++;
                console.error('שגיאה בשורה:', line);
            }
        }
    });
    
    // שמירה ב-localStorage
    localStorage.setItem('expenses', JSON.stringify(window.expenses));
    
    // הצגת הודעה למשתמש
    let message = `נוספו ${addedCount} הוצאות חדשות`;
    if (duplicateCount > 0) {
        message += `\nנמצאו ${duplicateCount} הוצאות כפולות שלא נוספו`;
    }
    if (errorCount > 0) {
        message += `\nנמצאו ${errorCount} שורות עם שגיאות`;
    }
    alert(message);
    
    // ניקוי שדה הקלט
    document.getElementById('expenseInput').value = '';
    
    // עדכון הטבלה והגרף
    window.updateTable();
    window.updateCharts();
};

// פונקציה ליצירת ID ייחודי
window.generateUniqueId = function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// פונקציה להמרת מספר חודש לשם בעברית
window.getHebrewMonth = function(month) {
    const months = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return months[month - 1];
};

// פונקציה לפורמט מספרים כמטבע
window.formatCurrency = function(amount) {
    return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'ILS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

// פונקציה ליצוא ל-CSV
window.exportToCSV = function() {
    const csvContent = window.generateCSVContent();
    
    // יצירת קובץ להורדה
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // הגדרת שם הקובץ עם התאריך הנוכחי
    const today = new Date();
    const fileName = `expenses_${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// פונקציה להעתקת CSV ללוח
window.copyCSVToClipboard = function() {
    const csvContent = window.generateCSVContent();
    navigator.clipboard.writeText(csvContent).then(() => {
        alert('הנתונים הועתקו ללוח בפורמט CSV');
    }).catch(err => {
        console.error('שגיאה בהעתקה:', err);
        alert('אירעה שגיאה בהעתקת הנתונים');
    });
};

// פונקציה ליצירת תוכן ה-CSV
window.generateCSVContent = function() {
    // מיון ההוצאות לפי תאריך
    const sortedExpenses = [...window.expenses].sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split('/').map(Number);
        const [dayB, monthB, yearB] = b.date.split('/').map(Number);
        
        if (yearA !== yearB) return yearA - yearB;
        if (monthA !== monthB) return monthA - monthB;
        return dayA - dayB;
    });
    
    // יצירת תוכן ה-CSV
    return sortedExpenses.map(expense => {
        // טיפול במרכאות כפולות בתיאור ובהערות
        const description = expense.description.replace(/"/g, '""');
        const comment = expense.comment ? expense.comment.replace(/"/g, '""') : '';
        const category = expense.category ? expense.category.replace(/"/g, '""') : '';
        
        // בניית שורת CSV
        return `"${expense.date}","${description}","${expense.amount}","${category}","${comment}"`;
    }).join('\n');
};

// פונקציה לעדכון הסיכום השנתי
window.updateYearlySummary = function() {
    const container = document.querySelector('#yearlySummaryContainer');
    if (!container) return;

    container.innerHTML = '';
    
    if (!window.expenses || !window.expenses.length) {
        container.innerHTML = '<div class="alert alert-info">אין הוצאות להצגה</div>';
        return;
    }

    // ארגון הנתונים לפי שנים וקטגוריות
    const yearlyData = {};
    window.expenses.forEach(expense => {
        const [, , year] = expense.date.split('/');
        if (!yearlyData[year]) {
            yearlyData[year] = {};
        }
        const category = expense.category || 'ללא קטגוריה';
        if (!yearlyData[year][category]) {
            yearlyData[year][category] = {
                total: 0,
                actualTotal: 0,
                count: 0,
                expenses: [],
                percentage: expense.percentage || 100
            };
        }
        const actualAmount = expense.amount * (expense.percentage || 100) / 100;
        yearlyData[year][category].total += expense.amount;
        yearlyData[year][category].actualTotal += actualAmount;
        yearlyData[year][category].count++;
        yearlyData[year][category].expenses.push(expense);
        yearlyData[year][category].percentage = expense.percentage || yearlyData[year][category].percentage;
    });

    // יצירת תצוגה לכל שנה
    Object.keys(yearlyData)
        .sort((a, b) => b - a)
        .forEach(year => {
            const yearCard = document.createElement('div');
            yearCard.className = 'card mb-4';
            yearCard.innerHTML = `
                <div class="card-header">
                    <h4 class="mb-0">סיכום שנתי - ${year}</h4>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>קטגוריה</th>
                                    <th>מספר הוצאות</th>
                                    <th class="text-end">סה"כ</th>
                                    <th class="text-end">ממוצע להוצאה</th>
                                    <th class="text-end">אחוז</th>
                                    <th class="text-end">סכום בפועל</th>
                                    <th>פעולות</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(yearlyData[year])
                                    .sort(([,a], [,b]) => b.total - a.total)
                                    .map(([category, data]) => {
                                        return `
                                            <tr>
                                                <td class="category-cell" onclick="window.editYearlyCategory(this, '${category}')">${category}</td>
                                                <td>${data.count}</td>
                                                <td class="text-end">${formatCurrency(data.total)}</td>
                                                <td class="text-end">${formatCurrency(data.total / data.count)}</td>
                                                <td class="text-end percentage-cell" onclick="window.editYearlyPercentage(this, '${category}')">${data.percentage}%</td>
                                                <td class="text-end">${formatCurrency(data.actualTotal)}</td>
                                                <td>
                                                    <div class="btn-group">
                                                        <button class="btn btn-sm btn-info" onclick="window.showCategoryDetails('${year}', '${category}')">
                                                            <i class="bi bi-info-circle"></i>
                                                        </button>
                                                        <button class="btn btn-sm btn-danger" onclick="window.deleteCategory('${category}')">
                                                            <i class="bi bi-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                            </tbody>
                            <tfoot>
                                <tr class="table-active">
                                    <td><strong>סה"כ</strong></td>
                                    <td>${Object.values(yearlyData[year]).reduce((sum, data) => sum + data.count, 0)}</td>
                                    <td class="text-end"><strong>${formatCurrency(Object.values(yearlyData[year]).reduce((sum, data) => sum + data.total, 0))}</strong></td>
                                    <td></td>
                                    <td></td>
                                    <td class="text-end"><strong>${formatCurrency(Object.values(yearlyData[year]).reduce((sum, data) => sum + data.actualTotal, 0))}</strong></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
            container.appendChild(yearCard);
        });
};

// פונקציה לעריכת הערה
window.editComment = function(cell, expenseId) {
    const expense = window.expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const currentComment = expense.comment || '';
    const newComment = prompt('הכנס הערה:', currentComment);
    
    if (newComment !== null) {
        expense.comment = newComment.trim();
        localStorage.setItem('expenses', JSON.stringify(window.expenses));
        window.updateTable();
        window.updateCharts();
    }
};
