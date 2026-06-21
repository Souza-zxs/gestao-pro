-- Carga inicial da Base de Clientes (dados exportados do Notion).
-- Rode DEPOIS da 006. É idempotente: não duplica se já houver clientes seus.
--
-- >>> EDITE a linha abaixo com o e-mail da SUA conta de login no app <<<
do $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower('SEU_EMAIL_AQUI@exemplo.com');
  if uid is null then
    raise exception 'Usuário não encontrado — ajuste o e-mail no topo da migration 007.';
  end if;
  if exists (select 1 from clientes where user_id = uid) then
    raise notice 'Já existem clientes para este usuário; carga ignorada.';
    return;
  end if;

  insert into clientes (
    user_id, nome, loja, telefone, data_entrada, responsavel, ja_vende,
    ultimo_acompanhamento, proximo_acompanhamento, evolucao_vendas, fase_conta,
    faturamento_mensal, plataforma, numero_contas, tipo_cobranca,
    login_upseller, senha_upseller, login_seller_finance, senha_seller_finance
  ) values
  (uid,'Elaine','03 - Ziv Modas','(11) 98531-5413','2025-07-25','Athirson Andrade',true,'2026-05-29','2026-06-05','Crescente','Fase 4 - Pré Escala','21 a 50k','Shopee',1,'Mensalidade','elainemendesdeoliveira@gmail.com','Mab260806@','',''),
  (uid,'Larissa e Bruno','01 - ModasLB','(33) 98726-2417','2024-03-03','Athirson Andrade',true,'2026-05-29','2026-06-05','Crescente','Fase 5 - Escala','0 a 20k','Shopee',1,'Pedido','showroomlarissamazzoni@gmail.com','Lalaoliveira1@@','',''),
  (uid,'Nubia','06 - Estilo Elegance','+55 62 99257-8961','2026-05-05','Matheus Sales',true,'2026-05-29','2026-06-05','Crescente','Fase 5 - Escala','51 a 100k','Shopee',1,'','Estiloelegancia1983@gmail.com','Sabedoria369&','',''),
  (uid,'Fabiola','04 - Ib atelie','+55 11 97824-2610','2026-04-22','Matheus Sales',false,'2026-05-29','2026-06-05','Crescente','Fase 1 - Implementação','0 a 20k','Shopee',1,'','Ibatelie12@gmail.com','Fabi1213@','',''),
  (uid,'Heloize','05 - Leonix_oficial','+55 11 91336-8895','2026-05-01','Athirson Andrade',false,'2026-05-29','2026-06-05','Crescente','Fase 1 - Implementação','0 a 20k','Shopee',1,'','','','',''),
  (uid,'Andrea','02 - Dolshoptop','+55 11 95049-8880','2026-03-01','Matheus Sales',true,'2026-05-29','2026-06-05','Crescente','Fase 2 - Primeiras Vendas','0 a 20k','Shopee',1,'','deia_toptudo@hotmail.com','thamires10!','',''),
  (uid,'Maria','09 - https://shopee.com.br/shop/819854850','+55 62 99144-0844','2026-05-11','Athirson Andrade',true,'2026-05-29','2026-06-05','','','','',1,'','maria86oliveirarosa31@gmail.com','Sophia1208','',''),
  (uid,'João','08 - Jv Moda Masculina','+55 81 99803-3038','2026-05-11','Athirson Andrade',true,'2026-05-29','2026-06-05','','','','',1,'','Jvitorr1911@gmail.com','Joao1112#','',''),
  (uid,'Fabiano','13 - Light Life','','2026-05-15','',true,'2026-05-29','2026-06-05','','','','',1,'','','','',''),
  (uid,'Veronia','11 - Dona Verona','',null,'',true,'2026-05-29','2026-06-05','','','','',1,'','','','',''),
  (uid,'Marcos','12 - Signa Moda Digital','','2026-05-19','',true,'2026-05-29','2026-06-05','','','','',1,'','','','',''),
  (uid,'Pauline','14 - Pauline Variedades','',null,'',true,null,null,'','','','',1,'','','','',''),
  (uid,'Allan','15 Sweet Kiis','+55 11 94901-0750','2026-06-12','',true,null,null,'','','','',1,'','sah_ravanhani@hotmail.com','As2511..','',''),
  (uid,'Allan','16 - Say. Lays','+55 11 94901-0750','2026-06-12','',true,null,null,'','','','',1,'','sah_ravanhani@hotmail.com','As2511..','',''),
  (uid,'Gleydson','17 - Sofy Jeans','+55 81 97901-0969','2026-06-15','',true,null,null,'','','','',1,'','','','','');
end $$;
