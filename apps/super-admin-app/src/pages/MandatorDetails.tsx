import { useParams, useNavigate } from 'react-router-dom';
import { useMandator, useActivateMandator, useDeactivateMandator } from '@/hooks/use-mandators';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';

export default function MandatorDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: mandator, isLoading } = useMandator(id!);
  const activateMutation = useActivateMandator();
  const deactivateMutation = useDeactivateMandator();

  const handleToggleStatus = async () => {
    if (!id || !mandator) return;

    try {
      if (mandator.isActive) {
        await deactivateMutation.mutateAsync(id);
        toast.success('Mandator deactivated successfully');
      } else {
        await activateMutation.mutateAsync(id);
        toast.success('Mandator activated successfully');
      }
    } catch (error) {
      toast.error('Failed to update mandator status');
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!mandator) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p>Mandator not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/mandators')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{mandator.companyName}</h1>
            <p className="text-muted-foreground">Mandator details and information</p>
          </div>
          <Button
            variant={mandator.isActive ? 'destructive' : 'default'}
            onClick={handleToggleStatus}
            disabled={activateMutation.isPending || deactivateMutation.isPending}
          >
            {mandator.isActive ? (
              <>
                <PowerOff className="mr-2 h-4 w-4" />
                Deactivate
              </>
            ) : (
              <>
                <Power className="mr-2 h-4 w-4" />
                Activate
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={mandator.isActive ? 'default' : 'secondary'} className="mt-1">
                  {mandator.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Company Name</p>
                <p className="font-medium">{mandator.companyName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contact Email</p>
                <p className="font-medium">{mandator.contactEmail}</p>
              </div>
              {mandator.contactPhone && (
                <div>
                  <p className="text-sm text-muted-foreground">Contact Phone</p>
                  <p className="font-medium">{mandator.contactPhone}</p>
                </div>
              )}
              {mandator.address && (
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{mandator.address}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {mandator.city && (
                  <div>
                    <p className="text-sm text-muted-foreground">City</p>
                    <p className="font-medium">{mandator.city}</p>
                  </div>
                )}
                {mandator.postalCode && (
                  <div>
                    <p className="text-sm text-muted-foreground">Postal Code</p>
                    <p className="font-medium">{mandator.postalCode}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mandator.adminFirstName && mandator.adminLastName && (
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {mandator.adminFirstName} {mandator.adminLastName}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{mandator.adminEmail || mandator.contactEmail}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">
                  {new Date(mandator.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              {mandator.contractStartDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Contract Start</p>
                  <p className="font-medium">
                    {new Date(mandator.contractStartDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {mandator.contractEndDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Contract End</p>
                  <p className="font-medium">
                    {new Date(mandator.contractEndDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
