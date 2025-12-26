import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MandatorsTable } from '@/components/mandators/MandatorsTable';
import { CreateMandatorDialog } from '@/components/mandators/CreateMandatorDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function Mandators() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mandators</h1>
            <p className="text-muted-foreground">
              Manage property mandators (landlords) and their accounts
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Mandator
          </Button>
        </div>

        <MandatorsTable />
      </div>

      <CreateMandatorDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </DashboardLayout>
  );
}
