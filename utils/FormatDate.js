export function formatDateString(dateString) {
    if (!dateString) return '';

    if (/,/.test(dateString)) return dateString;
    
    const matchDate = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    
    if (!matchDate) return dateString;
    
    const [, y, a, b] = matchDate;
    
    let year = Number(y), month = Number(a), day = Number(b);
    
    if (Number(a) > 12) { day = Number(a); month = Number(b); }
    
    const date = new Date(year, month - 1, day);
    
    if (isNaN(date)) return dateString;
    
    return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}