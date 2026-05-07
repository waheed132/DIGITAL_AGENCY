<?php

namespace App\Mail;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class InvoiceMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Invoice $invoice
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Invoice '.($this->invoice->invoice_number ?? '').' — '.config('invoices.agency_name', config('app.name')),
        );
    }

    public function content(): Content
    {
        return new Content(
            html: 'emails.invoice',
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        if (! $this->invoice->pdf_path || ! Storage::disk('local')->exists($this->invoice->pdf_path)) {
            return [];
        }

        return [
            Attachment::fromStorageDisk('local', $this->invoice->pdf_path)
                ->as('Invoice-'.($this->invoice->invoice_number ?? $this->invoice->id).'.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
