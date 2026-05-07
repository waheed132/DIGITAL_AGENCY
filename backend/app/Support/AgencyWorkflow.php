<?php

namespace App\Support;

/** Standard workflow steps per deliverable (one output item). */
final class AgencyWorkflow
{
    /** @return list<string> */
    public static function stepTitles(): array
    {
        return ['Script / Idea', 'Design', 'Review', 'Revision', 'Final delivery'];
    }

    public static function stepCount(): int
    {
        return 5;
    }
}
