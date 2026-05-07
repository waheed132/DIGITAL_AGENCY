<?php

namespace App\Mail;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvoiceSentMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Invoice $invoice,
        public string $pdfAbsolutePath
    ) {}

    public function envelope(): Envelope
    {
        $from = config('mail.from.address');
        $name = config('mail.from.name');

        return new Envelope(
            from: $from ? new Address($from, (string) $name) : null,
            subject: 'Invoice '.$this->invoice->invoice_number.' — '.config('invoices.agency_name', config('app.name')),
        );
    }

    public function content(): Content
    {
        return new Content(
            html: 'mail.invoice-sent',
            with: [
                'invoice' => $this->invoice,
            ],
        );
    }

    /**
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [
            \Illuminate\Mail\Mailables\Attachment::fromPath($this->pdfAbsolutePath)
                ->as('invoice-'.$this->invoice->invoice_number.'.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
