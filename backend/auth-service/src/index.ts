import app from './app';

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Auth Service corriendo en puerto ${PORT} de 6mmario`);
});
