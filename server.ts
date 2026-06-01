import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for sending email directly from application server
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing 'to', 'subject', or 'body' in request" });
    }

    const emailList = to.split(",").map((e: string) => e.trim()).filter(Boolean);
    if (emailList.length === 0) {
      return res.status(400).json({ error: "Invalid recipient email list" });
    }

    try {
      // Helper to clean quotes and whitespace robustly, including non-breaking/unicode spaces
      const cleanEnvVal = (val: string) => {
        if (!val) return "";
        let trimmed = val.replace(/^[\s\uFEFF\u00A0\u200B]+|[\s\uFEFF\u00A0\u200B]+$/g, '');
        // Handle double quotes
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          trimmed = trimmed.slice(1, -1);
          trimmed = trimmed.replace(/^[\s\uFEFF\u00A0\u200B]+|[\s\uFEFF\u00A0\u200B]+$/g, '');
        }
        // Handle single quotes
        if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
          trimmed = trimmed.slice(1, -1);
          trimmed = trimmed.replace(/^[\s\uFEFF\u00A0\u200B]+|[\s\uFEFF\u00A0\u200B]+$/g, '');
        }
        return trimmed;
      };

      let smtpHost = cleanEnvVal(process.env.SMTP_HOST || "");
      let smtpPortStr = cleanEnvVal(process.env.SMTP_PORT || "587");
      let smtpUser = cleanEnvVal(process.env.SMTP_USER || "");
      let smtpPass = cleanEnvVal(process.env.SMTP_PASS || "");

      if (smtpHost) {
        console.log("Attempting to send email via SMTP (robust sanitization)...");

        const smtpPort = parseInt(smtpPortStr || "587");

        // Auto-strip spaces from Google Gmail App Passwords
        const isGmail = smtpHost.toLowerCase().includes("gmail.com") || smtpHost.toLowerCase().includes("googlemail.com");
        if (isGmail) {
          smtpPass = smtpPass.replace(/\s+/g, "");
        }

        let smtpSecureStr = cleanEnvVal(process.env.SMTP_SECURE || "").toLowerCase();
        const smtpSecure = smtpSecureStr === "true" || smtpPort === 465;

        // Diagnostic logs (masked for security) to verify loaded secrets are current and uncorrupted
        const maskedUser = smtpUser ? (smtpUser.substring(0, 3) + "..." + smtpUser.split("@")[0].slice(-2) + "@" + (smtpUser.split("@")[1] || "gmail.com")) : "empty";
        const maskedPass = smtpPass ? (smtpPass.substring(0, 2) + "..." + smtpPass.slice(-2)) : "empty";
        console.log(`SMTP Config Diagnostic - Host: ${smtpHost}, Port: ${smtpPort}, User: ${maskedUser}, PassLength: ${smtpPass.length}, PassMask: ${maskedPass}, Secure: ${smtpSecure}`);

        let emailFrom = cleanEnvVal(process.env.EMAIL_FROM || "");

        // Robustly parse the raw email address for the From envelope, stripping out display names, quotes, or angle brackets
        const extractPureEmail = (emailStr: string): string => {
          if (!emailStr) return "";
          let cleaned = emailStr.trim();
          const bracketMatch = cleaned.match(/<([^>]+)>/);
          if (bracketMatch) {
            cleaned = bracketMatch[1];
          }
          // Remove any single/double quotes, remaining brackets, or whitespaces
          cleaned = cleaned.replace(/['"<>]/g, "").trim();
          // Strip all whitespace characters, including unicode, non-breaking, or zero-width spaces
          cleaned = cleaned.replace(/[\s\uFEFF\u00A0\u200B]+/g, "");
          return cleaned;
        };

        const pureFromEmail = extractPureEmail(emailFrom || smtpUser);
        console.log(`SMTP Prepared Pure Envelope Sender: '${pureFromEmail}'`);

        try {
          const transportOptions: any = {};
          
          if (isGmail) {
            // Using Nodemailer's built-in Gmail service configuration handles all port/SSL/TLS quirks perfectly
            transportOptions.service = "gmail";
            transportOptions.auth = {
              user: smtpUser,
              pass: smtpPass,
            };
          } else {
            transportOptions.host = smtpHost;
            transportOptions.port = smtpPort;
            transportOptions.secure = smtpSecure;
            transportOptions.auth = {
              user: smtpUser,
              pass: smtpPass,
            };
            transportOptions.tls = {
              rejectUnauthorized: false
            };
          }

          const transporter = nodemailer.createTransport(transportOptions);

          const mailOptions = {
            from: `"Remix CAT Prep Tracker" <${pureFromEmail}>`,
            to: emailList.join(", "),
            subject: subject,
            text: body,
            html: `<div style="font-family: sans-serif; white-space: pre-wrap; line-height: 1.6; color: #1e293b;">${body.replace(/\n/g, "<br>")}</div>`,
            envelope: {
              from: pureFromEmail,
              to: emailList
            }
          };

          const info = await transporter.sendMail(mailOptions);
          console.log("SMTP Message sent success: %s", info.messageId);

          return res.json({ 
            success: true, 
            provider: "smtp", 
            message: `Email dispatched successfully via SMTP! Message ID: ${info.messageId}` 
          });
        } catch (smtpErr: any) {
          console.warn("Nodemailer transporter.sendMail notice:", smtpErr?.message || smtpErr);
          let extraHelp = "";
          const errMessageLower = String(smtpErr.message || "").toLowerCase();
          if (isGmail && (errMessageLower.includes("auth") || errMessageLower.includes("password") || errMessageLower.includes("credentials") || errMessageLower.includes("login"))) {
            extraHelp = " Note: Gmail requires you to use a 16-character App Password (e.g. 'sofwjrkpaennkgzi') rather than your standard account login password. Please double-check Google Account > Security > App passwords to confirm.";
          } else if (smtpHost.toLowerCase().includes("brevo.com") && (errMessageLower.includes("auth") || errMessageLower.includes("password") || errMessageLower.includes("credentials") || errMessageLower.includes("login"))) {
            extraHelp = " Note: For Brevo SMTP, verify that SMTP is activated on your Brevo account, and that you are using the correct SMTP password (with the 'xsmtpsib-' prefix) from your Brevo 'SMTP & API' dashboard.";
          } else if (smtpHost.toLowerCase().includes("brevo.com") && (errMessageLower.includes("unauthorized ip") || errMessageLower.includes("525"))) {
            extraHelp = " Note: Brevo SMTP returned '525 5.7.1 Unauthorized IP address'. This means IP restrictions (Authorized IPs list) are enabled on your Brevo SMTP settings! To fix this, log into Brevo, go to 'SMTP & API', click on the 'SMTP' tab, and either turn off Authorized IP restrictions or remove all restricted IP addresses. Since the application runs in a cloud environment, its outbound IP address is dynamic.";
          }
          return res.status(200).json({
            success: false,
            provider: "smtp",
            error: `SMTP Sending Failed: ${smtpErr.message || String(smtpErr)}`,
            suggestedSetup: `Active Credentials Checked: User='${maskedUser}' (${smtpUser.length} chars), Pass='${maskedPass}' (${smtpPass.length} chars). Please verify your SMTP credentials from your Secrets tab.${extraHelp}`
          });
        }
      }

      // 2. Check for Resend configuration
      const resendApiKey = cleanEnvVal(process.env.RESEND_API_KEY || "");
      if (resendApiKey) {
        console.log("Attempting to send email via Resend API...");
        const resendInstance = new Resend(resendApiKey);

        let successfulCount = 0;
        const failedRecipients: { email: string; error: string; isSandbox: boolean }[] = [];
        let finalData = null;

        for (const recipient of emailList) {
          try {
            const { data, error } = await resendInstance.emails.send({
              from: process.env.EMAIL_FROM || "Remix CAT Tracker <onboarding@resend.dev>",
              to: [recipient],
              subject: subject,
              text: body,
              html: `<div style="font-family: sans-serif; white-space: pre-wrap; line-height: 1.6; color: #1e293b;">${body.replace(/\n/g, "<br>")}</div>`
            });

            if (error) {
              const errStr = String(error.message || '').toLowerCase() + ' ' + String((error as any).name || '').toLowerCase();
              const isSandbox = errStr.includes('validation') || errStr.includes('sandbox') || errStr.includes('restriction') || errStr.includes('verify') || errStr.includes('onboarding');
              failedRecipients.push({
                email: recipient,
                error: error.message || "Validation Error",
                isSandbox
              });
              console.log(`Failed to send to ${recipient} via Resend. Sandbox: ${isSandbox}. Error: ${error.message}`);
            } else {
              console.log(`Successfully sent to ${recipient} via Resend.`);
              successfulCount++;
              if (!finalData) finalData = data;
            }
          } catch (individualErr: any) {
            const errStr = String(individualErr.message || '').toLowerCase();
            const isSandbox = errStr.includes('validation') || errStr.includes('sandbox') || errStr.includes('restriction') || errStr.includes('verify') || errStr.includes('onboarding');
            failedRecipients.push({
              email: recipient,
              error: individualErr.message || String(individualErr),
              isSandbox
            });
            console.warn(`Exception during sending to ${recipient}:`, individualErr?.message || individualErr);
          }
        }

        if (successfulCount > 0) {
          let extraMessage = "";
          if (failedRecipients.length > 0) {
            const sandboxEmails = failedRecipients.filter(r => r.isSandbox).map(r => r.email);
            const otherEmails = failedRecipients.filter(r => !r.isSandbox).map(r => r.email);

            if (sandboxEmails.length > 0) {
              extraMessage += `\n\nNotice: Delivery to ${sandboxEmails.join(", ")} was bypassed due to Resend Free Sandbox restrictions (unverified recipient address). Only registered Resend account owner emails can receive messages directly in Sandbox mode.`;
            }
            if (otherEmails.length > 0) {
              extraMessage += `\n\nNotice: Other failures: ${otherEmails.join(", ")}`;
            }
          }

          return res.json({
            success: true,
            provider: "resend",
            message: `Sent successfully to ${successfulCount} recipient(s).${extraMessage}`,
            result: finalData
          });
        }

        // If no deliveries succeeded
        const firstSandboxError = failedRecipients.find(r => r.isSandbox);
        if (firstSandboxError) {
          return res.status(200).json({ 
            success: false, 
            provider: "resend_sandbox_restriction", 
            error: "Resend Free-Tier Sandbox Restriction: Emails can only be sent to your own verified Resend account owner email.",
            reason: "SANDBOX_RECIPIENT_RESTRICTION",
            suggestedSetup: `Resend sandbox restrictions prevent delivering from the default 'onboarding@resend.dev' sender to unverified recipient domains (${emailList.join(", ")}).

To ensure your board members receive these emails:
1) Use the orange "via Local Client" button nearby to open your native email app and dispatch immediately from your computer.
2) Register and verify a custom domain on Resend.com, and configure the 'EMAIL_FROM' environment setting.
3) Use standard SMTP variables instead (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) via your Secrets tab.
4) For instant testing via the app server, set the board email under the 'Audit' settings tab to your registered Resend account address.`
          });
        }

        return res.status(200).json({
          success: false,
          error: failedRecipients[0]?.error || "Resend Send Error",
          reason: "RESEND_SEND_FAILED",
          suggestedSetup: "Please check your Resend credentials in your Secrets configuration."
        });
      }

      // 3. Fallback: Neither configured
      console.warn("Email requested but no production email credentials are set in environment.");
      return res.status(400).json({
        success: false,
        error: "Direct email service is not configured on the server yet.",
        reason: "MISSING_CREDENTIALS",
        suggestedSetup: "Please set either RESEND_API_KEY or SMTP parameters (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) in your environment settings (via the Settings/Secrets drawer in AI Studio) to authorize direct emailing."
      });

    } catch (e: any) {
      const errStrLine = String(e.message || '').toLowerCase() + ' ' + String(e.name || '').toLowerCase();
      
      if (
        errStrLine.includes('validation_error') || 
        errStrLine.includes('validation') ||
        errStrLine.includes('sandbox') || 
        errStrLine.includes('restriction') || 
        errStrLine.includes('verify') ||
        errStrLine.includes('onboarding')
      ) {
        console.log("Resend exception handled as sandbox constraint. Returning failure notice.");
        return res.status(200).json({ 
          success: false, 
          provider: "resend_sandbox_restriction", 
          error: "Resend Free-Tier Sandbox Restriction (Caught Exception): Emails can only be sent to your own verified Resend account owner email.",
          reason: "SANDBOX_RECIPIENT_RESTRICTION",
          suggestedSetup: `Resend sandbox restrictions prevent delivering from the default 'onboarding@resend.dev' sender to unverified recipient domains (${emailList.join(", ")}).

To ensure your board members receive these emails:
1) Use the orange "via Local Client" button nearby to open your native email app and dispatch immediately from your computer.
2) Register and verify a custom domain on Resend.com, and configure the 'EMAIL_FROM' environment setting.
3) Use standard SMTP variables instead (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) via your Secrets tab.
4) For instant testing via the app server, set the board email under the 'Audit' settings tab to your registered Resend account address.`
        });
      }

      console.log("Handled server-side email failure event:", e.message || String(e));

      return res.status(500).json({
        success: false,
        error: e.message || String(e)
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
