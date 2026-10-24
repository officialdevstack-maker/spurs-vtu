insert into data_types (id, label) values ('sme','SME'), ('vtu','VTU'), ('sns','SNS')
on conflict do nothing;

insert into networks (id, name, enabled, airtime_discount, sort_order) values
  ('mtn','MTN',true,2.5,1), ('glo','Glo',true,3,2), ('airtel','Airtel',true,2,3), ('9mobile','9mobile',false,3.5,4)
on conflict do nothing;

insert into network_data_types (network_id, type_id) values
  ('mtn','sme'), ('mtn','vtu'), ('mtn','sns'),
  ('glo','sme'), ('glo','vtu'),
  ('airtel','sme'), ('airtel','vtu'), ('airtel','sns'),
  ('9mobile','sme')
on conflict do nothing;

insert into data_plans (id, network_id, type_id, size, validity, cost, price, active) values
  ('mtn-1','mtn','sme','500MB','30 days',130,145,true),
  ('mtn-2','mtn','sme','1GB','30 days',250,270,true),
  ('mtn-3','mtn','sme','2GB','30 days',500,530,true),
  ('mtn-4','mtn','vtu','1.5GB','30 days',950,1000,true),
  ('mtn-5','mtn','sns','3GB','30 days',1400,1480,false),
  ('glo-1','glo','sme','1GB','14 days',280,300,true),
  ('glo-2','glo','sme','2.9GB','30 days',900,940,true),
  ('glo-3','glo','vtu','5.8GB','30 days',1900,1980,true),
  ('airtel-1','airtel','sme','1GB','7 days',320,345,true),
  ('airtel-2','airtel','sns','2GB','30 days',1450,1500,true),
  ('airtel-3','airtel','vtu','4GB','30 days',2000,2090,true),
  ('9m-1','9mobile','sme','1.5GB','30 days',480,510,false)
on conflict do nothing;

insert into pin_stock (id, network_id, kind, label, price, available, used) values
  ('mtn-ap-1','mtn','airtime','₦100 airtime pin',98,240,560),
  ('mtn-ap-2','mtn','airtime','₦200 airtime pin',196,120,310),
  ('mtn-ap-3','mtn','airtime','₦500 airtime pin',490,8,190),
  ('mtn-dp-1','mtn','data','1GB · 30 days',270,60,95),
  ('mtn-dp-2','mtn','data','2GB · 30 days',530,5,41),
  ('glo-ap-1','glo','airtime','₦100 airtime pin',97,90,140),
  ('glo-ap-2','glo','airtime','₦200 airtime pin',194,45,80),
  ('glo-dp-1','glo','data','2.9GB · 30 days',940,22,18),
  ('airtel-ap-1','airtel','airtime','₦100 airtime pin',98,150,220)
on conflict do nothing;
