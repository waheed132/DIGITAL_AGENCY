<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskAttachment extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'task_id',
        'uploaded_by',
        'attachment_type',
        'original_name',
        'mime_type',
        'size',
        'storage_path',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
