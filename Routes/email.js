/*
const express = require('express');
const router = express.Router();
const { generateEmailHTML } = require('../utils/generateHtml')
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_KEY);
//me permite enviar a mi correo unico verificado es decir tendre que usarlo para el formulario de newsletter y contacto
router.post('/send-email', async (req, res) => {
  const { to, subject, htmlContent } = req.body;

(async function () {
  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@resend.dev>',
    to: [`${to}`],
    subject: `${subject}`,
    html: `${htmlContent}`,
  });

  if (error) {
    return console.error({ error });
  }

  console.log({ data });  
})();
});

module.exports = router;*/