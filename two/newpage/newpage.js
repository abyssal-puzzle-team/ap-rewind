let finalKey;

fetch('../keys.json')
    .then(response => response.json())
    .then(data => {
        finalKey = data.finalKey;
    })
    .catch(error => console.error('加载 keys.json 出错:', error));

function checkFinalPassword() {
    const input = document.getElementById('final-password');
    const enteredKey = input.value;

    if (enteredKey === finalKey) {
        input.style.borderColor = '#4CAF50';
        input.style.backgroundColor = '#1a5f20';
        input.value = '密钥正确';
        input.disabled = true;
        setTimeout(() => {
            window.location.href = '/two/finalpage';
        }, 1000);
    } else {
        input.style.borderColor = '#f44336';
        input.style.backgroundColor = '#5f1a1a';
        input.value = '密钥错误';
        setTimeout(() => {
            input.value = '';
            input.style.borderColor = '#444';
            input.style.backgroundColor = '#222';
        }, 1000);
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        checkFinalPassword();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('final-password');
    input.addEventListener('keypress', handleKeyPress);
});