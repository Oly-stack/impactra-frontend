document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const alertMessage = document.getElementById('alertMessage');

    if (!registerForm || !alertMessage) {
        return;
    }

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(registerForm);
        const payload = Object.fromEntries(formData.entries());

        alertMessage.textContent = '';
        alertMessage.classList.remove('success', 'error');

        try {
            const response = await fetch('http://localhost:5000/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed. Please try again.');
            }

            alertMessage.textContent = data.message || 'Registration successful!';
            alertMessage.classList.add('success');
            registerForm.reset();

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1200);
        } catch (error) {
            alertMessage.textContent = error.message || 'Unable to create account.';
            alertMessage.classList.add('error');
        }
    });
});