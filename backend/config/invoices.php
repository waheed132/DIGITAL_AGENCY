<?php

return [

    'agency_name' => env('INVOICE_AGENCY_NAME', config('app.name', 'Agency')),

    'agency_tagline' => env('INVOICE_AGENCY_TAGLINE', ''),

    'payment_notes' => env('INVOICE_PAYMENT_NOTES', 'Thank you for your business. Please include the invoice number with your payment.'),

    'default_due_days' => (int) env('INVOICE_DUE_DAYS', 14),
];
