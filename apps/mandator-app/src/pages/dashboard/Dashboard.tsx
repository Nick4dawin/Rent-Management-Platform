import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Home, Users, FileText } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    {
      title: 'Total Buildings',
      value: '0',
      icon: Building2,
      description: 'Properties under management',
    },
    {
      title: 'Total Units',
      value: '0',
      icon: Home,
      description: 'Units across all buildings',
    },
    {
      title: 'Active Tenants',
      value: '0',
      icon: Users,
      description: 'Current tenants',
    },
    {
      title: 'Active Leases',
      value: '0',
      icon: FileText,
      description: 'Ongoing lease agreements',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your property management portal</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Set up your property management system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Start by creating your first building, then add units, and invite tenants.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
