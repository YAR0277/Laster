DROP TRIGGER IF EXISTS drivers_set_account_status
ON public.drivers;

CREATE TRIGGER drivers_set_account_status
BEFORE INSERT OR UPDATE
ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.set_driver_account_status();