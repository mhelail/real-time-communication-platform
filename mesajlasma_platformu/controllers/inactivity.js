
const inactivityTime = 900000; // (15dk=90000ms)
let timeout;

function resetTimer() {
    clearTimeout(timeout);
    timeout = setTimeout(logout, inactivityTime);
}

function logout() {
    alert("Hareketsiz kaldınız. Lütfen tekrar giriş yapın.");
    window.location.href = "LOGIN_PAGE"; // Giriş sayfasının URL'si
}

window.onload = resetTimer;  
document.onmousemove = resetTimer; 
document.onkeypress = resetTimer; 